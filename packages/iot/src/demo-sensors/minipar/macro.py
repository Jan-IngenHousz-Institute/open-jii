values = [item["par"] for item in json["set"]]
return {
    "PAR": round(sum(values) / len(values), 3),
    "PAR_min": min(values),
    "PAR_max": max(values),
}
