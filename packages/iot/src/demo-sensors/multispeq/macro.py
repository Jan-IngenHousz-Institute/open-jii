trace = json["set"][0]
values = trace["data_raw"]
fs = sum(values[:3]) / 3
fm_prime = sum(values[3:6]) / 3
return {
    "Phi2": round((fm_prime - fs) / fm_prime, 6),
    "Fs": fs,
    "Fm_prime": fm_prime,
    "PAR": trace["light_intensity"],
}
