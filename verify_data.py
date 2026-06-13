#!/usr/bin/env python3
import os
import csv

DATA_DIR = "/Users/sanjeev/Downloads/datas"
DAILY_PATH = os.path.join(DATA_DIR, "agritech_daily_database.csv")
MONTHLY_PATH = os.path.join(DATA_DIR, "agritech_monthly_database.csv")
STATION_PATH = os.path.join(DATA_DIR, "agritech_station_database.csv")

def verify_file(file_path, expected_cols_count=None):
    print("=" * 60)
    print(f"Verifying file: {os.path.basename(file_path)}...")
    
    if not os.path.exists(file_path):
        print(f"FAIL: File does not exist: {file_path}")
        return False
        
    size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print(f"File size: {size_mb:.2f} MB")
    
    try:
        with open(file_path, "r", newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)
            print("Columns:", header)
            
            row_count = 0
            null_count = 0
            corrupt_rows = 0
            
            # Simple value checks
            temp_oob = 0
            soil_oob = 0
            
            # Find column indices if present
            sand_idx = header.index("soil_sand_pct") if "soil_sand_pct" in header else -1
            clay_idx = header.index("soil_clay_pct") if "soil_clay_pct" in header else -1
            silt_idx = header.index("soil_silt_pct") if "soil_silt_pct" in header else -1
            ph_idx = header.index("soil_ph") if "soil_ph" in header else -1
            rain_idx = header.index("rainfall") if "rainfall" in header else (header.index("mean_rainfall") if "mean_rainfall" in header else -1)
            tavg_idx = header.index("t2m_avg") if "t2m_avg" in header else (header.index("mean_t2m") if "mean_t2m" in header else -1)
            month_idx = header.index("month") if "month" in header else -1
            
            for r in reader:
                row_count += 1
                if len(r) != len(header):
                    corrupt_rows += 1
                    continue
                
                # Check for nulls
                for val in r:
                    if val.strip() == "" or val.lower() in ("nan", "null", "none"):
                        null_count += 1
                
                # Check ranges
                try:
                    if sand_idx != -1:
                        sand = float(r[sand_idx])
                        clay = float(r[clay_idx])
                        silt = float(r[silt_idx])
                        if not (0 <= sand <= 100 and 0 <= clay <= 100 and 0 <= silt <= 100):
                            soil_oob += 1
                    if ph_idx != -1:
                        ph = float(r[ph_idx])
                        if not (3.0 <= ph <= 11.0):
                            soil_oob += 1
                    if tavg_idx != -1:
                        temp = float(r[tavg_idx])
                        if not (-10 <= temp <= 60):
                            temp_oob += 1
                except ValueError:
                    corrupt_rows += 1
                    
            print(f"Total Rows: {row_count}")
            print(f"Corrupt or malformed rows: {corrupt_rows}")
            print(f"Total nulls: {null_count}")
            print(f"Out of bounds temperatures: {temp_oob}")
            print(f"Out of bounds soil parameters: {soil_oob}")
            
            if corrupt_rows > 0 or null_count > 0:
                print("FAIL: Found corrupt rows or null values!")
                return False
            else:
                print("SUCCESS: Data checks passed!")
                return True
                
    except Exception as e:
        print(f"FAIL: Error reading file: {e}")
        return False

def main():
    v1 = verify_file(DAILY_PATH)
    v2 = verify_file(MONTHLY_PATH)
    v3 = verify_file(STATION_PATH)
    
    if v1 and v2 and v3:
        print("\n=== ALL FILES SUCCESSFULLY VERIFIED! ===")
    else:
        print("\n=== VERIFICATION FAILED FOR ONE OR MORE FILES ===")

if __name__ == "__main__":
    main()
