"""
Exact FMP2 calculation logic extracted from experiment_pipeline.py.
This maintains the exact same logic and calculations as used in the pipeline.
"""

import numpy as np
import pandas as pd
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, IntegerType, FloatType
from pyspark.sql import DataFrame

def calc_fmp2_pandas_udf(pdf):
    """
    Exact pandas UDF function from the experiment pipeline.
    
    Args:
        pdf: Pandas DataFrame for a single Count group
        
    Returns:
        Pandas DataFrame with Count, Fs, Fmp, Fmp_T columns
    """
    # Apply the exact same calc_FMP2 logic as the notebook
    y = (pdf['SigF'] / pdf['RefF']).to_numpy()
    _count_nonzero = np.count_nonzero(~np.isnan(y))
    
    if _count_nonzero < 30:
        return pd.DataFrame({'Count': [pdf['Count'].iloc[0]], 'Fs': [np.nan], 'Fmp': [np.nan], 'Fmp_T': [np.nan]})
    
    # Get the meta_Actinic value for Act_coef
    act_coef = pdf['meta_Actinic'].iloc[0] if not pd.isna(pdf['meta_Actinic'].iloc[0]) else 0.1
    ambient_offset = 100
    
    # Exact same MFP2_calc_sections as original
    MFP2_calc_sections = {
        0:   [0,   10,  5],
        249: [10,  50,  10],
        200: [50,  60,  4],
        120: [60,  70,  4],
        100: [70,  80,  4],
        80:  [80,  90,  4],
        60:  [90,  100, 4],
        250: [100, 140, 10]
    }
    
    _fmp_potentials = (y[MFP2_calc_sections[249][0]:MFP2_calc_sections[249][1]].tolist() + 
                      y[MFP2_calc_sections[250][0]:MFP2_calc_sections[250][1]].tolist())
    _count_nonzero = np.count_nonzero(~np.isnan(_fmp_potentials))
    
    if _count_nonzero < 10:
        return pd.DataFrame({'Count': [pdf['Count'].iloc[0]], 'Fs': [np.nan], 'Fmp': [np.nan], 'Fmp_T': [np.nan]})
    
    ret = {"Fs": np.nan, "Fmp": np.nan, "Fmp_T": np.nan}
    _Act, _Fluo = [], []
    
    for sec in MFP2_calc_sections:
        _range = MFP2_calc_sections[sec]
        _fluor = y[_range[0]:_range[1]]
        _count_nonzero = np.count_nonzero(~np.isnan(_fluor))
        
        if _count_nonzero < _range[2]:
            continue
            
        if sec == 0:
            if _count_nonzero > 6:
                ret.update({"Fs": np.nanquantile(_fluor, .1)})
            else:
                ret.update({"Fs": np.nanmean(_fluor)})
        else:
            if _count_nonzero > 6:
                _Act.append(sec)
                _Fluo.append(np.nanquantile(_fluor, .9))
            else:
                _Act.append(sec)
                _Fluo.append(np.nanmax(_fluor))
    
    _Act = np.array(_Act) / act_coef + ambient_offset
    _Fluo = np.array(_Fluo)
    
    if np.count_nonzero(~np.isnan(_Fluo)) > 3 and ~np.isnan(ret['Fs']):
        try:
            k, c = np.polyfit(1/_Act, _Fluo, deg=1)
            good_fit = True
            if k > 5:
                good_fit = False
            if c < ret['Fs']:
                good_fit = False
        except:
            good_fit = False
        
        if good_fit:
            ret.update({"Fmp": c, "Fmp_T": np.nanmax(_fmp_potentials)})
            return pd.DataFrame({'Count': [pdf['Count'].iloc[0]], 'Fs': [ret["Fs"]], 'Fmp': [ret["Fmp"]], 'Fmp_T': [ret["Fmp_T"]]})
    
    ret.update({"Fmp": np.nanmax(_fmp_potentials), "Fmp_T": np.nanmax(_fmp_potentials)})
    return pd.DataFrame({'Count': [pdf['Count'].iloc[0]], 'Fs': [ret["Fs"]], 'Fmp': [ret["Fmp"]], 'Fmp_T': [ret["Fmp_T"]]})


def apply_fmp2_calculations(df: DataFrame) -> DataFrame:
    """
    Apply FMP2 calculations to a Spark DataFrame exactly as done in the pipeline.
    
    Args:
        df: Input Spark DataFrame with MPF2 data
        
    Returns:
        DataFrame with Fs, Fmp, Fmp_T columns added
    """
    # Filter for MPF2 type and calculate FMP2 values
    mpf2_df = df.filter(F.col("Type") == "MPF2")
    
    if mpf2_df.count() > 0:
        # Schema for FMP2 calculation results
        fmp2_schema = StructType([
            StructField("Count", IntegerType(), True),
            StructField("Fs", FloatType(), True),
            StructField("Fmp", FloatType(), True),
            StructField("Fmp_T", FloatType(), True)
        ])
        
        # Create pandas UDF with exact function from pipeline
        pandas_udf = F.pandas_udf(returnType=fmp2_schema, functionType=F.PandasUDFType.GROUPED_MAP)(calc_fmp2_pandas_udf)
        
        # Apply the FMP2 calculation
        fmp2_results = mpf2_df.groupBy("Count").apply(pandas_udf)
        
        # Join back to main dataframe
        result_df = df.join(fmp2_results, on="Count", how="left")
    else:
        # Add empty FMP2 columns if no MPF2 data
        result_df = (df.withColumn("Fs", F.lit(None).cast("float"))
                      .withColumn("Fmp", F.lit(None).cast("float"))
                      .withColumn("Fmp_T", F.lit(None).cast("float")))
    
    return result_df