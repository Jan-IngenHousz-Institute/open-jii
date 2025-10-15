"""
Ambyte trace file processing functions.

This module contains all the core processing logic for parsing Ambyte trace files.
"""

import pandas as pd
import numpy as np
import datetime
from typing import List, Optional


def protocol_array_calc(arr: np.ndarray, actual_size=-1):
    if arr.size == 3:
        if actual_size == -1:
            return [[0, arr[1], arr[2]]], (1 + np.arange(arr[1])) * arr[0] * 100, True
        return [[0, arr[1], arr[2]]], (np.arange(actual_size) + 1) * arr[0] * 100, arr[1] == actual_size

    _type = arr[:, 0]
    _num = arr[:, 2] * 256 + arr[:, 3]
    _freq = arr[:, 4] * 256 + arr[:, 5]
    _act = arr[:, 6]

    elapsed_time = 0
    timeline_line = []
    section_start_idx = 0
    section_line = []

    for _n, _f, _m, _a in zip(_num, _freq, _type, _act):
        if _m == 0:
            continue
        _start, _end = section_start_idx, section_start_idx + _n
        section_start_idx += _n

        if section_line and (_a == section_line[-1][2]):
            section_line[-1][1] = _end
        else:
            section_line.append([_start, _end, _a])

        timeline_line += (np.arange(_n) * (1000 / _f) + elapsed_time).tolist()
        elapsed_time = timeline_line[-1]

        if actual_size > 0 and (len(timeline_line) > actual_size):
            extra = len(timeline_line) - actual_size
            section_line[-1][1] -= extra
            return section_line, np.array(timeline_line[:-extra]), False

    return section_line, np.array(timeline_line), True


def parse_trace(trace: list):
    # Check trace type and parse header
    if trace[0][:2] == "A\t":
        arr_info = trace[0].strip().split('\t')
        if len(arr_info) != 5:
            print("Invalid A entry")
            return {"suc": False}
        t0_rel_ms = int(arr_info[1])
        t1_rel_ms = int(arr_info[2])
        protocol_name = arr_info[3]
        protocol_arr = np.reshape(np.fromstring(arr_info[4], int, sep=','), (-1, 8))
    elif trace[0][:2] == "S\t":
        arr_info = trace[0].strip().split('\t')
        if len(arr_info) != 6:
            return {"suc": False}
        t0_rel_ms = int(arr_info[1])
        t1_rel_ms = int(arr_info[2])
        protocol_name = "SPACER"
        protocol_arr = np.array([int(arr_info[3]), int(arr_info[4]), int(arr_info[5])])
    else:
        return {"suc": False}

    # Parse fluorescence and reference
    try:
        flur = np.fromstring(trace[2][3:], dtype=int, sep=",") if trace[2][:3] == "T1\t" else None
        ref = np.fromstring(trace[3][3:], dtype=int, sep=",") if trace[3][:3] == "T2\t" else None
    except Exception:
        return {"suc": False}

    if flur is None or ref is None or len(flur) != len(ref) or len(flur) < 8:
        return {"suc": False}
    actual_size = len(flur)
    trace_array = np.zeros((actual_size, 10), dtype=np.int64)
    protocol_sections, protocol_rel_ms, full_length = protocol_array_calc(protocol_arr, actual_size)
    trace_array[:, 1] = flur
    trace_array[:, 2] = ref
    for section in protocol_sections:
        trace_array[section[0]:section[1], 7] = section[2]

    # Optional: parse sun/leaf and 7s/7r if present
    sun = leaf = _7s = _7r = None
    if len(trace) > 5:
        if trace[4][:3] == "T3\t":
            sun = np.fromstring(trace[4][3:], dtype=int, sep=",") - 65536
        if trace[5][:3] == "T4\t":
            leaf = np.fromstring(trace[5][3:], dtype=int, sep=",") - 65536
        if sun is not None and leaf is not None and len(sun) == actual_size and len(leaf) == actual_size:
            trace_array[:, 3] = sun / 16
            trace_array[:, 4] = leaf / 16
    if len(trace) > 7:
        if trace[6][:3] == "T5\t":
            _7s = np.fromstring(trace[6][3:], dtype=int, sep=",")
        if trace[7][:3] == "T6\t":
            _7r = np.fromstring(trace[7][3:], dtype=int, sep=",")
        if _7s is not None and _7r is not None and len(_7s) == actual_size and len(_7r) == actual_size:
            trace_array[:, 5] = _7s
            trace_array[:, 6] = _7r

    # Parse T0 timeline if present
    millis = 0
    time_warp_factor = 0.900 if protocol_name == "SPACER" else 0.8586
    if trace[1][:2] == "T0":
        t0_timeline = trace[1].strip().split('\t')
        if len(t0_timeline) == 2:
            t0_info = np.fromstring(t0_timeline[1], dtype=np.uint32, sep=",")
            if len(t0_info) > 1:
                start_ms_0, end_ms_0 = 0, 0
                for e in t0_info:
                    millis = np.bitwise_and(e, 0xFFFF0000) >> 10
                    _type = np.bitwise_and(e, 0x0000F000) >> 12
                    _data = np.bitwise_and(e, 0x00000FFF)
                    if _type == 4:
                        arr_idx = np.searchsorted(protocol_rel_ms, millis)
                        trace_array[arr_idx - 1, 8] = _data + 2732
                    else:
                        if _type == 0 and start_ms_0 == 0:
                            start_ms_0 = millis + _data
                        if _type == 1:
                            end_ms_0 = millis + _data
                if start_ms_0 > 0 and end_ms_0 > 100:
                    _time_warp_factor = (end_ms_0 - start_ms_0) / (protocol_rel_ms[-1] - 2 * protocol_rel_ms[0] + protocol_rel_ms[1])
                    if 0.75 < _time_warp_factor < 1.25:
                        time_warp_factor = _time_warp_factor
    trace_array[:, 0] = protocol_rel_ms * time_warp_factor + t0_rel_ms

    return {
        "suc": True,
        "arr": trace_array,
        "Trace_type": protocol_name,
        "t1": t0_rel_ms,
        "t2": t1_rel_ms,
        "tm": millis,
        "Full": full_length,
        "Duration": end_ms_0 - start_ms_0 if 'end_ms_0' in locals() else None
    }


def process_trace_files(ambyte_folder: str, files_per_byte: List[List[list]]) -> Optional[pd.DataFrame]:
    """Process trace files and return a concatenated DataFrame (Databricks only).

    The legacy ms_offset bug has been removed; timestamp alignment uses per-ambit sizing.
    """
    all_dfs: List[pd.DataFrame] = []
    
    # Detect if this is an unknown_ambit case by checking if only the first element has data
    is_unknown_ambit = (
        len([data for data in files_per_byte if data]) == 1 and 
        files_per_byte[0] and 
        not any(files_per_byte[1:])
    )

    for ambit_index, ambit_data in enumerate(files_per_byte):
        if not ambit_data:
            continue
        print(f"Processing ambit index {ambit_index}, ambyte folder: {ambyte_folder}")

        try:
            Traces_df: List[pd.DataFrame] = []
            for lines in ambit_data:
                try:
                    _timestamp = int(lines[0].split("\t")[2])
                except Exception:
                    _timestamp = 0
                print("Processing date: ", datetime.datetime.fromtimestamp(_timestamp, datetime.timezone.utc) if _timestamp else "N/A")
                # Per-ambit ms_offset sizing (fixed behavior)
                ms_offset_factor = np.ones(len(ambit_data) + 10)
                _line_count_1 = -1
                _line_counter_traces = -1
                Trace_count = 0

                _par_dict_l: list = []
                _leafT_dict_l: list = []
                RTC_T0_MS = 0
                _Header_t0_ms = 0
                _Header_RTC_ms = 0
                _header_counter = 0
                Metadata = []  # ensure defined even if INFO block absent

                for n in range(len(lines)):
                    _line = lines[n].strip()
                    if _line.startswith("I1\t"):
                        _line_split = _line.split("\t")
                        if len(_line_split) > 5:
                            _Header_t0_ms = int(_line_split[1])
                            _Header_RTC_ms = int(_line_split[2]) * 1000
                            _header_counter += 1
                    if _line.startswith("H1\t"):
                        _line_split = _line.split("\t")
                        if len(_line_split) == 4:
                            _Header_t0_ms = int(_line_split[1])
                            _Header_RTC_ms = int(_line_split[2]) * 1000

                    if _line.startswith("I1\t") or _line.startswith("H1\t"):
                        if (_Header_t0_ms > 0) and (_Header_RTC_ms > 0):
                            RTC_T0_MS = int(_Header_RTC_ms - _Header_t0_ms)

                    if _line.startswith("INFO START"):
                        _line_count_1 = n + 1
                    if _line.startswith("INFO END") and _line_count_1 > 1:
                        Metadata = lines[_line_count_1:n]

                    trace_ret = {'suc': False}
                    if (_line_counter_traces >= 0) and _line[:2] == 'T' + str(n - _line_counter_traces - 1):
                        pass
                    elif _line_counter_traces >= 0:
                        trace_ret = parse_trace(lines[_line_counter_traces:n])
                        _line_counter_traces = -1
                    if (_line[:2] == "A\t") or (_line[:2] == "S\t"):
                        _line_counter_traces = n

                    if _line[:2] == "P\t":
                        _pars = _line.split('\t')
                        try:
                            _par_dict = {
                                't': int(_pars[1]) + RTC_T0_MS,
                                'PAR': float(_pars[2]),
                                'raw': float(_pars[13]),
                                'spec': np.array(list(map(int, _pars[3:13])), dtype=np.uint16).tolist(),
                                'Time': 0
                            }
                            _par_dict_l.append(_par_dict)
                        except Exception:
                            pass
                    if _line[:2] == "L\t":
                        _leaf_l = _line.split('\t')
                        try:
                            _leafT_dict = {
                                't': int(_leaf_l[1]) + RTC_T0_MS,
                                'Temp': float(_leaf_l[2]),
                                'BoardT': float(_leaf_l[4]),
                                'Time': 0
                            }
                            _leafT_dict_l.append(_leafT_dict)
                        except Exception:
                            pass

                    if trace_ret['suc']:
                        Trace_count += 1
                        df = pd.DataFrame(trace_ret['arr'], columns=[
                            't', 'SigF', 'RefF', 'Sun', 'Leaf', 'Sig7', 'Ref7', 'Actinic', 'Temp', 'Res'
                        ])
                        df['Full'] = trace_ret['Full']
                        df['Type'] = trace_ret['Trace_type']
                        if not df['t'].is_monotonic_increasing:
                            print("Warning: Time not monotonic")
                        df['Count'] = Trace_count
                        # Timestamp alignment using corrected per-ambit offset factor
                        idx = min(_header_counter, len(ms_offset_factor) - 1)
                        df['Time'] = pd.to_datetime(df['t'] + RTC_T0_MS - df['t'][0] * (1 - ms_offset_factor[idx]), unit='ms')
                        df['PTS'] = np.arange(df.shape[0]).astype('int32')  # Use int32 instead of uint16
                        if len(df.loc[df['Time'] < "2020"]):
                            df.drop(df.loc[df['Time'] < "2020"].index)

                        if Traces_df:
                            _last_df = Traces_df[-1]
                            if _last_df['Time'].iloc[-1] > df['Time'].iloc[0]:
                                mask = df['Time'] < _last_df['Time'].iloc[-1]
                                if np.count_nonzero(mask) > 0:
                                    print(f"Warning: Interlaced time in trace {Trace_count} ({np.count_nonzero(mask)} rows removed)")
                                    df.drop(index=df.loc[mask].index, inplace=True)
                        Traces_df.append(df)

                if not Traces_df:
                    continue

            # Merge traces for this ambit
            df_ambit = pd.concat(Traces_df)
            df_ambit.set_index('Time', inplace=True)
            if not df_ambit.index.is_monotonic_increasing:
                print("Warning: Ambit index not monotonic after concat")
            df_ambit.sort_index(inplace=True)

            # Attach PAR records
            if _par_dict_l:
                for rec in _par_dict_l:
                    _dt = pd.to_datetime(rec['t'], unit='ms')
                    _idx = df_ambit.index.searchsorted(_dt, side='right')
                    if _idx > 0:
                        rec['Time'] = df_ambit.iloc[_idx - 1].name
                df_par = pd.DataFrame(_par_dict_l)
                df_par.drop(columns=['t'], inplace=True)
                df_ambit = df_ambit.join(df_par.set_index('Time'), how='left')
                
                # Ensure spec column has consistent array type for Spark compatibility
                if 'spec' in df_ambit.columns:
                    df_ambit['spec'] = df_ambit['spec'].apply(lambda x: x if isinstance(x, list) else [])

            # Temperature conversions & leaf temps
            df_ambit.loc[df_ambit['Temp'] == 0, 'Temp'] = np.nan
            df_ambit['Temp'] = df_ambit['Temp'] / 10 - 273.1

            if _leafT_dict_l:
                for rec in _leafT_dict_l:
                    _dt = pd.to_datetime(rec['t'], unit='ms')
                    _idx = df_ambit.index.searchsorted(_dt, side='right')
                    if _idx > 0:
                        rec['Time'] = df_ambit.iloc[_idx - 1].name
                df_leaf = pd.DataFrame(_leafT_dict_l)
                df_leaf.drop(index=df_leaf[df_leaf['Time'].isna()].index, inplace=True, errors='ignore')
                df_leaf.drop(columns=['t'], inplace=True, errors='ignore')
                if not df_leaf.empty:
                    df_leaf['Time'] = df_leaf['Time'].astype('datetime64[ns]')
                    df_ambit = df_ambit.combine_first(df_leaf.set_index('Time'))

            attrs = {}
            for _l in Metadata:
                for _tabs in _l.strip().split('\t'):
                    if _tabs.startswith("Act:"):
                        attrs.update({"Actinic": float(_tabs[4:])})
                    if _tabs.startswith("Dark:"):
                        attrs.update({"Dark": int(_tabs[5:])})

            if "Actinic" in attrs:
                df_ambit['meta_Actinic'] = attrs["Actinic"]
            if "Dark" in attrs:
                df_ambit['meta_Dark'] = attrs["Dark"]

            # Type / dtype normalization - using Spark-compatible types
            df_ambit['Sig7'] = df_ambit['Sig7'].astype('int32')
            df_ambit['Ref7'] = df_ambit['Ref7'].astype('int32')
            df_ambit.loc[(df_ambit['Sig7'] < 1) | (df_ambit['Ref7'] < 10), ['Sig7', 'Ref7']] = None
            df_ambit['Sun'] = df_ambit['Sun'].astype('int32')
            df_ambit['Sun'] -= df_ambit['Sun'].min()
            df_ambit['Leaf'] = df_ambit['Leaf'].astype('int32')
            df_ambit['Leaf'] -= df_ambit['Leaf'].min()
            df_ambit['Actinic'] = df_ambit['Actinic'].astype('int32')  # Convert categorical to int32
            df_ambit['Res'] = df_ambit['Res'].astype('int32')
            df_ambit['Type'] = df_ambit['Type'].astype('string')  # Convert categorical to string
            df_ambit['Count'] = df_ambit['Count'].astype('int32')
            if 'raw' in df_ambit.columns:
                df_ambit['raw'] = df_ambit['raw'].astype('float32')
            if 'PAR' in df_ambit.columns:
                df_ambit['PAR'] = df_ambit['PAR'].astype('float32')
            df_ambit['Temp'] = df_ambit['Temp'].astype('float32')
            if 'BoardT' in df_ambit.columns:
                df_ambit['BoardT'] = df_ambit['BoardT'].astype('float32')
            if 'meta_Actinic' in df_ambit.columns:
                df_ambit['meta_Actinic'] = df_ambit['meta_Actinic'].astype('float32')
            if 'meta_Dark' in df_ambit.columns:
                df_ambit['meta_Dark'] = df_ambit['meta_Dark'].astype('int32')
            df_ambit.drop(columns=['t'], inplace=True, errors='ignore')

            # Identification columns
            df_ambit['ambyte_folder'] = ambyte_folder
            # Set ambit_index to null for unknown_ambit case, otherwise use normal index
            if is_unknown_ambit:
                df_ambit['ambit_index'] = None  # Use None instead of pd.NA for Spark compatibility
            else:
                df_ambit['ambit_index'] = ambit_index + 1
            df_ambit['ambit_index'] = df_ambit['ambit_index'].astype('int32')  # Ensure int32 type
            all_dfs.append(df_ambit)

        except Exception as e:  # pragma: no cover - defensive
            print(f"Error processing ambit {ambit_index}: {e}")

    if not all_dfs:
        return None
    return pd.concat(all_dfs)
