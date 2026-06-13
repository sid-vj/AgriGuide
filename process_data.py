#!/usr/bin/env python3
import os
import zipfile
import csv
import math
from collections import defaultdict

# --- Configuration & Paths ---
DATA_DIR = "/Users/sanjeev/Downloads/datas"
GROUNDWATER_ZIP = os.path.join(DATA_DIR, "archive.zip")
GROUNDWATER_CSV = "Groundwater India Data.csv"

SOIL_FILES = {
    "sand": ("wosis_latest.zip", "wosis_latest_sand.csv"),
    "phaq": ("wosis_latest (1).zip", "wosis_latest_phaq.csv"),
    "orgc": ("wosis_latest (2).zip", "wosis_latest_orgc.csv"),
    "clay": ("wosis_latest (3).zip", "wosis_latest_clay.csv"),
    "silt": ("wosis_latest (4).zip", "wosis_latest_silt.csv"),
    "cfvo": ("wosis_latest (5).zip", "wosis_latest_cfvo.csv"),
}

OUTPUT_DAILY = os.path.join(DATA_DIR, "agritech_daily_database.csv")
OUTPUT_MONTHLY = os.path.join(DATA_DIR, "agritech_monthly_database.csv")
OUTPUT_STATION = os.path.join(DATA_DIR, "agritech_station_database.csv")


# --- Helper Functions ---
def haversine(lat1, lon1, lat2, lon2):
    """Calculate geodesic distance in kilometers between two points on Earth."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


# --- Step 1: Load and Aggregate Soil Properties ---
def load_and_aggregate_soil():
    """
    Reads each WoSIS soil zip file, aggregates layer measurements using a
    depth-weighted average per profile, and returns a dictionary:
    {
       prop_name: {
          profile_id: {
             'lat': float,
             'lon': float,
             'val': float
          }
       }
    }
    """
    aggregated_soil = {}
    
    for prop, (zip_name, csv_name) in SOIL_FILES.items():
        print(f"Processing soil property: '{prop}' from {zip_name}...")
        zip_path = os.path.join(DATA_DIR, zip_name)
        
        # Temp store for aggregating layers: profile_id -> [sum(val*thickness), sum(thickness), lat, lon]
        profile_data = {}
        
        with zipfile.ZipFile(zip_path) as z:
            with z.open(csv_name) as f:
                # Need to read as text
                text_file = f.read().decode('utf-8', errors='ignore').splitlines()
                reader = csv.reader(text_file)
                header = next(reader)
                
                # Column indices
                pid_idx = header.index("profile_id")
                x_idx = header.index("X")
                y_idx = header.index("Y")
                ud_idx = header.index("upper_depth")
                ld_idx = header.index("lower_depth")
                val_idx = header.index("value_avg")
                
                for r in reader:
                    if len(r) <= max(pid_idx, x_idx, y_idx, ud_idx, ld_idx, val_idx):
                        continue
                    
                    pid = r[pid_idx]
                    try:
                        x = float(r[x_idx]) # Longitude
                        y = float(r[y_idx]) # Latitude
                        upper = float(r[ud_idx])
                        lower = float(r[ld_idx])
                        val = float(r[val_idx])
                    except ValueError:
                        # Skip if missing coordinates, depths, or value
                        continue
                    
                    # Compute thickness of layer
                    thickness = lower - upper
                    if thickness <= 0:
                        thickness = 1.0 # fallback
                    
                    if pid not in profile_data:
                        profile_data[pid] = [0.0, 0.0, y, x] # [weighted_sum, total_thickness, lat, lon]
                    
                    profile_data[pid][0] += val * thickness
                    profile_data[pid][1] += thickness
        
        # Calculate final weighted average per profile
        aggregated_soil[prop] = {}
        for pid, (w_sum, t_thick, lat, lon) in profile_data.items():
            if t_thick > 0:
                avg_val = w_sum / t_thick
                aggregated_soil[prop][pid] = {
                    'lat': lat,
                    'lon': lon,
                    'val': avg_val
                }
        print(f"  Loaded {len(aggregated_soil[prop])} unique profiles for '{prop}'.")
        
    return aggregated_soil


# --- Step 2: Precompute Station Coordinates & Find Nearest Soil Properties ---
def map_stations_to_soil(aggregated_soil):
    """
    Reads the groundwater stations, finds their unique coordinates,
    and maps each station to its nearest soil profile values.
    Returns:
       station_soil_map: {
          station_id: {
             'prop_val': float,
             'prop_dist': float,
             'prop_pid': str,
             ...
          }
       }
       station_coords: {
          station_id: (lat, lon)
       }
    """
    print("Pre-scanning groundwater dataset for stations and coordinates...")
    station_coords = {}
    
    with zipfile.ZipFile(GROUNDWATER_ZIP) as z:
        with z.open(GROUNDWATER_CSV) as f:
            text_file = f.read().decode('utf-8', errors='ignore').splitlines()
            reader = csv.reader(text_file)
            header = next(reader)
            
            st_idx = header.index("station_id")
            lat_idx = header.index("latitude")
            lon_idx = header.index("longitude")
            
            for r in reader:
                if len(r) <= max(st_idx, lat_idx, lon_idx):
                    continue
                st_id = r[st_idx]
                if st_id not in station_coords:
                    try:
                        lat = float(r[lat_idx])
                        lon = float(r[lon_idx])
                        station_coords[st_id] = (lat, lon)
                    except ValueError:
                        continue
                        
    print(f"Found {len(station_coords)} unique stations. Computing nearest-neighbor soil attributes...")
    
    # Pre-map: station_id -> soil features
    station_soil_map = {}
    
    for st_id, (st_lat, st_lon) in station_coords.items():
        st_features = {}
        total_dist = 0.0
        
        for prop, profiles in aggregated_soil.items():
            min_d = float('inf')
            best_pid = None
            best_val = 0.0
            
            for pid, p_info in profiles.items():
                d = haversine(st_lat, st_lon, p_info['lat'], p_info['lon'])
                if d < min_d:
                    min_d = d
                    best_pid = pid
                    best_val = p_info['val']
            
            st_features[f"soil_{prop}_pct" if prop in ("sand", "clay", "silt", "cfvo") else f"soil_{prop}"] = best_val
            st_features[f"soil_{prop}_dist_km"] = min_d
            st_features[f"soil_{prop}_profile_id"] = best_pid
            total_dist += min_d
            
        st_features["average_soil_distance_km"] = total_dist / len(aggregated_soil)
        station_soil_map[st_id] = st_features
        
    print("Completed nearest-neighbor mapping for all stations.")
    return station_soil_map, station_coords


# --- Step 3: Process and Merge Datasets ---
def process_and_merge():
    # 1. Load soil data
    aggregated_soil = load_and_aggregate_soil()
    
    # 2. Map stations to soil
    station_soil_map, station_coords = map_stations_to_soil(aggregated_soil)
    
    # 3. Read groundwater dataset and generate outputs
    print("Reading and merging groundwater observations...")
    
    # Data structures for aggregation
    # station_id -> list of daily records for averaging
    station_daily_records = defaultdict(list)
    # (station_id, month) -> list of daily records for monthly averaging
    station_monthly_records = defaultdict(list)
    
    # Output file writers (for daily, we write line-by-line to avoid memory issues)
    # Define clean header for daily file
    soil_props = ["sand", "clay", "silt", "phaq", "orgc", "cfvo"]
    soil_headers = []
    for prop in soil_props:
        p_name = f"soil_{prop}_pct" if prop in ("sand", "clay", "silt", "cfvo") else f"soil_{prop}"
        soil_headers.extend([p_name, f"soil_{prop}_dist_km", f"soil_{prop}_profile_id"])
    soil_headers.append("average_soil_distance_km")
    
    clean_header = [
        "time_idx", "station_id", "datetime", "groundwater_level", "rainfall",
        "t2m_avg", "t2m_max", "t2m_min", "month", "latitude", "longitude",
        "well_depth", "well_aquifer_type", "state_encoded", "district_encoded"
    ] + soil_headers
    
    print(f"Writing daily matched database to: {OUTPUT_DAILY}...")
    with open(OUTPUT_DAILY, "w", newline="", encoding="utf-8") as f_out:
        writer = csv.writer(f_out)
        writer.writerow(clean_header)
        
        with zipfile.ZipFile(GROUNDWATER_ZIP) as z:
            with z.open(GROUNDWATER_CSV) as f_in:
                text_file = f_in.read().decode('utf-8', errors='ignore').splitlines()
                reader = csv.reader(text_file)
                orig_header = next(reader)
                
                # Index mappings
                t_idx = orig_header.index("time_idx")
                st_idx = orig_header.index("station_id")
                dt_idx = orig_header.index("datetime")
                targ_idx = orig_header.index("target")
                rain_idx = orig_header.index("rainfall")
                t2m_idx = orig_header.index("t  kmnpnn]2m")
                tmax_idx = orig_header.index("t2m_max")
                tmin_idx = orig_header.index("t2m_min")
                m_idx = orig_header.index("month")
                lat_idx = orig_header.index("latitude")
                lon_idx = orig_header.index("longitude")
                wdep_idx = orig_header.index("wellDepth")
                waq_idx = orig_header.index("wellAquiferType_encoded")
                st_enc_idx = orig_header.index("State_encoded")
                dist_enc_idx = orig_header.index("District_encoded")
                
                for r in reader:
                    if len(r) <= max(st_enc_idx, dist_enc_idx):
                        continue
                    
                    st_id = r[st_idx]
                    month_val = int(r[m_idx])
                    
                    # Convert measurements to floats
                    try:
                        gw_lvl = float(r[targ_idx])
                        rain = float(r[rain_idx])
                        t2m = float(r[t2m_idx])
                        tmax = float(r[tmax_idx])
                        tmin = float(r[tmin_idx])
                        lat = float(r[lat_idx])
                        lon = float(r[lon_idx])
                        wdepth = float(r[wdep_idx])
                        waq = int(r[waq_idx])
                        state = int(r[st_enc_idx])
                        district = int(r[dist_enc_idx])
                    except ValueError:
                        continue
                    
                    # Get matched soil features
                    soil_feats = station_soil_map.get(st_id)
                    if not soil_feats:
                        continue # Skip stations with no valid coordinates/soil matches
                        
                    # Assemble row
                    out_row = [
                        r[t_idx], st_id, r[dt_idx], gw_lvl, rain,
                        t2m, tmax, tmin, month_val, lat, lon,
                        wdepth, waq, state, district
                    ]
                    
                    # Add soil values in order
                    for prop in soil_props:
                        p_name = f"soil_{prop}_pct" if prop in ("sand", "clay", "silt", "cfvo") else f"soil_{prop}"
                        out_row.extend([
                            soil_feats[p_name],
                            f"{soil_feats[f'soil_{prop}_dist_km']:.2f}",
                            soil_feats[f"soil_{prop}_profile_id"]
                        ])
                    out_row.append(f"{soil_feats['average_soil_distance_km']:.2f}")
                    
                    # Write daily row
                    writer.writerow(out_row)
                    
                    # Save for aggregations
                    station_daily_records[st_id].append((gw_lvl, rain, t2m, tmax, tmin, wdepth, waq, state, district))
                    station_monthly_records[(st_id, month_val)].append((gw_lvl, rain, t2m, tmax, tmin))
                    
    print(f"Daily matched database written successfully ({len(station_daily_records)} stations).")
    
    # --- Generate Station-Level Database ---
    print(f"Generating station-level database to: {OUTPUT_STATION}...")
    station_header = [
        "station_id", "latitude", "longitude", "well_depth", "well_aquifer_type",
        "state_encoded", "district_encoded", "mean_groundwater_level", "mean_rainfall",
        "mean_t2m", "mean_t2m_max", "mean_t2m_min"
    ] + [h for h in soil_headers if "profile_id" not in h] # Soil values + distance columns
    
    with open(OUTPUT_STATION, "w", newline="", encoding="utf-8") as f_out:
        writer = csv.writer(f_out)
        writer.writerow(station_header)
        
        for st_id, records in station_daily_records.items():
            lat, lon = station_coords[st_id]
            soil_feats = station_soil_map[st_id]
            
            # Means of weather and water columns
            gw_sum = sum(rec[0] for rec in records)
            rain_sum = sum(rec[1] for rec in records)
            t2m_sum = sum(rec[2] for rec in records)
            tmax_sum = sum(rec[3] for rec in records)
            tmin_sum = sum(rec[4] for rec in records)
            
            wdepth = records[0][5]
            waq = records[0][6]
            state = records[0][7]
            district = records[0][8]
            
            n = len(records)
            out_row = [
                st_id, lat, lon, wdepth, waq, state, district,
                f"{gw_sum/n:.3f}", f"{rain_sum/n:.3f}", f"{t2m_sum/n:.3f}", f"{tmax_sum/n:.3f}", f"{tmin_sum/n:.3f}"
            ]
            
            # Add soil properties and distances
            for prop in soil_props:
                p_name = f"soil_{prop}_pct" if prop in ("sand", "clay", "silt", "cfvo") else f"soil_{prop}"
                out_row.extend([
                    soil_feats[p_name],
                    f"{soil_feats[f'soil_{prop}_dist_km']:.2f}"
                ])
            out_row.append(f"{soil_feats['average_soil_distance_km']:.2f}")
            writer.writerow(out_row)
            
    print(f"Station-level database written successfully.")
    
    # --- Generate Monthly-Level Database ---
    print(f"Generating monthly seasonal database to: {OUTPUT_MONTHLY}...")
    monthly_header = [
        "station_id", "month", "latitude", "longitude", "well_depth", "well_aquifer_type",
        "state_encoded", "district_encoded", "mean_groundwater_level", "mean_rainfall",
        "mean_t2m", "mean_t2m_max", "mean_t2m_min"
    ] + [h for h in soil_headers if "profile_id" not in h]
    
    with open(OUTPUT_MONTHLY, "w", newline="", encoding="utf-8") as f_out:
        writer = csv.writer(f_out)
        writer.writerow(monthly_header)
        
        # Sort keys by station_id and month
        sorted_keys = sorted(station_monthly_records.keys())
        
        for st_id, month_val in sorted_keys:
            records = station_monthly_records[(st_id, month_val)]
            lat, lon = station_coords[st_id]
            soil_feats = station_soil_map[st_id]
            
            # Get other static info from daily records
            first_daily = station_daily_records[st_id][0]
            wdepth = first_daily[5]
            waq = first_daily[6]
            state = first_daily[7]
            district = first_daily[8]
            
            gw_sum = sum(rec[0] for rec in records)
            rain_sum = sum(rec[1] for rec in records)
            t2m_sum = sum(rec[2] for rec in records)
            tmax_sum = sum(rec[3] for rec in records)
            tmin_sum = sum(rec[4] for rec in records)
            
            n = len(records)
            out_row = [
                st_id, month_val, lat, lon, wdepth, waq, state, district,
                f"{gw_sum/n:.3f}", f"{rain_sum/n:.3f}", f"{t2m_sum/n:.3f}", f"{tmax_sum/n:.3f}", f"{tmin_sum/n:.3f}"
            ]
            
            # Add soil properties and distances
            for prop in soil_props:
                p_name = f"soil_{prop}_pct" if prop in ("sand", "clay", "silt", "cfvo") else f"soil_{prop}"
                out_row.extend([
                    soil_feats[p_name],
                    f"{soil_feats[f'soil_{prop}_dist_km']:.2f}"
                ])
            out_row.append(f"{soil_feats['average_soil_distance_km']:.2f}")
            writer.writerow(out_row)
            
    print("Monthly seasonal database written successfully.")
    print("All tasks completed successfully!")


if __name__ == "__main__":
    process_and_merge()
