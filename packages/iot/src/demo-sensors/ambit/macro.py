trace = json["set"][0]
signal = sum(trace["s_630"]) / len(trace["s_630"])
reference = sum(trace["r_630"]) / len(trace["r_630"])
return {
    "signal_630_mean": round(signal, 3),
    "reference_630_mean": round(reference, 3),
    "signal_reference_ratio": round(signal / reference, 6),
    "temperature_c": trace["env"][0]["temp_c"],
}
