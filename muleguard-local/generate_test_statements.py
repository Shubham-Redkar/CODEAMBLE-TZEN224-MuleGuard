import os
import csv
from datetime import datetime, timedelta

def create_statement_csv(filepath, header_info, rows):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for line in header_info:
            writer.writerow([line])
        writer.writerow([])
        writer.writerow(["Transaction Date", "Value Date", "Narration", "Reference No", "Debit Amount (₹)", "Credit Amount (₹)", "Balance (₹)"])
        
        running_bal = float(rows[0].get("balance", 50000.0))
        for r in rows:
            debit = r.get("debit", "")
            credit = r.get("credit", "")
            
            d_val = float(debit) if debit != "" else 0.0
            c_val = float(credit) if credit != "" else 0.0
            
            if "balance" in r and r["balance"] is not None:
                running_bal = float(r["balance"])
            else:
                running_bal = running_bal - d_val + c_val
                
            writer.writerow([
                r["date"],
                r.get("val_date", r["date"]),
                r["narration"],
                r.get("ref", f"REF{abs(hash(r['narration'])) % 10000000000}"),
                f"{d_val:.2f}" if d_val > 0 else "",
                f"{c_val:.2f}" if c_val > 0 else "",
                f"{running_bal:.2f}"
            ])

# ==========================================
# 1. HIGH RISK: Pass-Through Velocity Mule (45 txns, ₹32L volume)
# ==========================================
def gen_high_risk_pass_through():
    header = [
        "Account Statement - HDFC Bank",
        "Account Number: 50100458921101",
        "Account Name: Rohit Sharma",
        "Branch: Andheri East, Mumbai",
        "IFSC: HDFC0000128",
        "Statement Period: 01/03/2024 to 15/03/2024"
    ]
    rows = []
    base_date = datetime(2024, 3, 1, 9, 0)
    bal = 1200.0
    rows.append({"date": base_date.strftime("%d/%m/%Y"), "narration": "Opening Balance", "balance": bal})
    
    # 20 pairs of rapid credit followed by rapid debit within 15-30 minutes
    counterparties_in = ["KUMAR_ENTERPRISES", "DIGITAL_PAY_SERVICES", "ALOK_TRADERS", "VIKRAM_SINGH", "APEX_SOLUTIONS", "NEHA_FINCORP", "SWIFT_TRANSFERS"]
    counterparties_out = ["CRYPTO_EXCHANGE_P2P", "CASH_OUT_AGENT_99", "OFFSHORE_REMIT", "GLOBAL_TRADING_CO", "QUICK_SETTLE_PAY"]
    
    curr = base_date
    for i in range(1, 22):
        in_amt = 75000.0 + (i * 3500.0)
        curr += timedelta(hours=8, minutes=10)
        c_in = counterparties_in[i % len(counterparties_in)]
        rows.append({
            "date": curr.strftime("%d/%m/%Y"),
            "narration": f"IMPS/CR/{i}098234/{c_in}/SBIN0001122/FUNDS_TRANSFER",
            "credit": in_amt
        })
        bal += in_amt
        
        # Immediate debit 15 mins later (98% pass-through)
        curr += timedelta(minutes=15)
        out_amt = in_amt - (150.0 + (i * 20.0))
        c_out = counterparties_out[i % len(counterparties_out)]
        rows.append({
            "date": curr.strftime("%d/%m/%Y"),
            "narration": f"UPI/DR/{i}998811/{c_out}/HDFC0012/IMMEDIATE_SETTLEMENT",
            "debit": out_amt
        })
        bal -= out_amt

    return header, rows

# ==========================================
# 2. HIGH RISK: Circular Mule Ring / Round-Tripping (36 txns, ₹18L volume)
# ==========================================
def gen_high_risk_circular_ring():
    header = [
        "Account Statement - State Bank of India",
        "Account Number: 30981123456",
        "Account Name: Aryan Verma",
        "Branch: Connaught Place, New Delhi",
        "IFSC: SBIN0000691",
        "Statement Period: 01/02/2024 to 28/02/2024"
    ]
    rows = []
    base_date = datetime(2024, 2, 1, 10, 0)
    bal = 5000.0
    rows.append({"date": base_date.strftime("%d/%m/%Y"), "narration": "Opening Balance", "balance": bal})
    
    ring_nodes = ["RING_NODE_ALPHA", "RING_NODE_BETA", "RING_NODE_GAMMA", "ENTITY_45"]
    curr = base_date
    for i in range(1, 18):
        amt = 95000.0 + (i % 3) * 5000.0
        curr += timedelta(days=1, hours=2)
        source = ring_nodes[i % len(ring_nodes)]
        target = ring_nodes[(i + 1) % len(ring_nodes)]
        
        # Credit from ring node
        rows.append({
            "date": curr.strftime("%d/%m/%Y"),
            "narration": f"RTGS/CR/SBIN202402{i:02d}/{source}/CIR_POOL_TRANSFER",
            "credit": amt
        })
        bal += amt
        
        # Debit back to another ring node in the cycle
        curr += timedelta(hours=3)
        rows.append({
            "date": curr.strftime("%d/%m/%Y"),
            "narration": f"NEFT/DR/HDFC202402{i:02d}/{target}/CIRCULAR_SETTLEMENT",
            "debit": amt - 200.0
        })
        bal -= (amt - 200.0)
        
    return header, rows

# ==========================================
# 3. HIGH RISK: Smurfing & Near-Threshold Structuring (52 txns, ₹24.8L volume)
# ==========================================
def gen_high_risk_smurfing():
    header = [
        "Account Statement - ICICI Bank",
        "Account Number: 002305009871",
        "Account Name: Rajesh Gupta",
        "Branch: Indiranagar, Bangalore",
        "IFSC: ICIC0000023",
        "Statement Period: 10/01/2024 to 25/01/2024"
    ]
    rows = []
    base_date = datetime(2024, 1, 10, 8, 30)
    bal = 3000.0
    rows.append({"date": base_date.strftime("%d/%m/%Y"), "narration": "Opening Balance", "balance": bal})
    
    curr = base_date
    # 25 credits just below 50,000 (INR 48,500 - 49,900) from 25 different individuals
    accumulated = 0.0
    for i in range(1, 26):
        curr += timedelta(hours=3, minutes=20)
        # Near-threshold structuring band: 48,000 to 49,800
        smurf_amt = 48500.0 + ((i * 70) % 1300)
        rows.append({
            "date": curr.strftime("%d/%m/%Y"),
            "narration": f"UPI/CR/4011{i:04d}/DEPOSITOR_AGENT_{i:02d}/YESB0/CONSULTANCY_FEE",
            "credit": smurf_amt
        })
        accumulated += smurf_amt
        
        # Every 5 credits, drain lump sum
        if i % 5 == 0:
            curr += timedelta(minutes=45)
            drain_amt = accumulated - 500.0
            rows.append({
                "date": curr.strftime("%d/%m/%Y"),
                "narration": f"RTGS/DR/ICIC202401{i:02d}/MASTER_CONSOLIDATOR/AGGREGATE_TRANSFER",
                "debit": drain_amt
            })
            accumulated = 500.0

    return header, rows

# ==========================================
# 4. HIGH RISK: Dormant Then Sudden Burst Mule (28 txns, ₹45L volume)
# ==========================================
def gen_high_risk_dormant_burst():
    header = [
        "Account Statement - Axis Bank",
        "Account Number: 918010045231",
        "Account Name: Suresh Patel",
        "Branch: CG Road, Ahmedabad",
        "IFSC: UTIB0000084",
        "Statement Period: 01/10/2023 to 15/01/2024"
    ]
    rows = []
    # Opening on 01/10/2023
    rows.append({"date": "01/10/2023", "narration": "Opening Balance", "balance": 850.0})
    rows.append({"date": "05/10/2023", "narration": "UPI/DR/123001/TEA_STALL/UTIB0/SNACKS", "debit": 50.0})
    # Complete silence / dormancy for 85 days!
    burst_date = datetime(2024, 1, 12, 23, 30) # Sudden midnight burst
    curr = burst_date
    for i in range(1, 14):
        in_amt = 175000.0 + (i * 10000.0)
        curr += timedelta(hours=1, minutes=15)
        rows.append({
            "date": curr.strftime("%d/%m/%Y"),
            "narration": f"IMPS/CR/401299{i:02d}/ANON_REMITTER_{i}/SBIN001/INSTANT_FUNDS",
            "credit": in_amt
        })
        # Immediate withdrawal / transfer
        curr += timedelta(minutes=20)
        rows.append({
            "date": curr.strftime("%d/%m/%Y"),
            "narration": f"RTGS/DR/AXIS202401{i:02d}/HAWALA_EXIT_NODE_{i}/CLEARED",
            "debit": in_amt - 100.0
        })

    return header, rows

# ==========================================
# 5. MEDIUM RISK: Freelancer Burst (35 txns, ₹8.5L volume)
# ==========================================
def gen_medium_risk_freelancer():
    header = [
        "Account Statement - HDFC Bank",
        "Account Number: 50100984712390",
        "Account Name: Ananya Sen",
        "Branch: Salt Lake, Kolkata",
        "IFSC: HDFC0000034",
        "Statement Period: 01/01/2024 to 28/02/2024"
    ]
    rows = []
    base_date = datetime(2024, 1, 1, 10, 0)
    bal = 85000.0
    rows.append({"date": base_date.strftime("%d/%m/%Y"), "narration": "Opening Balance", "balance": bal})
    curr = base_date
    
    # Regular daily living expenses
    for day in range(1, 45, 2):
        curr = base_date + timedelta(days=day, hours=day % 8)
        # Small living expense
        rows.append({
            "date": curr.strftime("%d/%m/%Y"),
            "narration": f"UPI/DR/4100{day}/SWIGGY_GROCERY/HDFC00/DAILY",
            "debit": 450.0 + (day * 20.0)
        })
        
        # 3 international client project milestones received
        if day in [10, 25, 40]:
            project_fee = 220000.0 + (day * 1000.0)
            rows.append({
                "date": curr.strftime("%d/%m/%Y"),
                "narration": f"INWARD_WIRE/CR/DEUT0001/UPWORK_GLOBAL_INC/DESIGN_CONTRACT_PAYMENT",
                "credit": project_fee
            })
            # Pay sub-contractor 4 days later (retaining 60%)
            sub_date = curr + timedelta(days=4)
            rows.append({
                "date": sub_date.strftime("%d/%m/%Y"),
                "narration": f"NEFT/DR/HDFC0001/DEV_FREELANCER_TEAM/UI_DEVELOPMENT",
                "debit": 75000.0
            })

    return header, rows

# ==========================================
# 6. MEDIUM RISK: Odd-Hours Cloud Kitchen (40 txns, ₹6.2L volume)
# ==========================================
def gen_medium_risk_odd_hours():
    header = [
        "Account Statement - Kotak Mahindra Bank",
        "Account Number: 771200456123",
        "Account Name: Midnight Cravings Cloud Kitchen",
        "Branch: Indiranagar, Bangalore",
        "IFSC: KKBK0000421",
        "Statement Period: 01/03/2024 to 20/03/2024"
    ]
    rows = []
    base_date = datetime(2024, 3, 1, 23, 0)
    bal = 45000.0
    rows.append({"date": base_date.strftime("%d/%m/%Y"), "narration": "Opening Balance", "balance": bal})
    
    curr = base_date
    for i in range(1, 20):
        # Night-time orders (11 PM - 3:30 AM)
        curr += timedelta(days=1, hours=1, minutes=10)
        night_collection = 14500.0 + (i * 650.0)
        rows.append({
            "date": curr.strftime("%d/%m/%Y"),
            "narration": f"UPI/CR/4003{i:04d}/ZOMATO_SWIGGY_PAYOUT/RATN001/NIGHT_SETTLEMENT",
            "credit": night_collection
        })
        
        # Daytime vendor payment for poultry / vegetables
        day_date = curr + timedelta(hours=9)
        rows.append({
            "date": day_date.strftime("%d/%m/%Y"),
            "narration": f"IMPS/DR/KKBK00{i:02d}/METRO_WHOLESALE_VEG/VEGETABLE_SUPPLIES",
            "debit": 8500.0 + (i * 300.0)
        })

    return header, rows

# ==========================================
# 7. MEDIUM RISK: Property Sale Advance (18 txns, ₹25L volume)
# ==========================================
def gen_medium_risk_property():
    header = [
        "Account Statement - ICICI Bank",
        "Account Number: 001201554433",
        "Account Name: Meera Joshi",
        "Branch: Aundh, Pune",
        "IFSC: ICIC0000012",
        "Statement Period: 01/01/2024 to 31/01/2024"
    ]
    rows = []
    bal = 120000.0
    rows.append({"date": "01/01/2024", "narration": "Opening Balance", "balance": bal})
    rows.append({"date": "03/01/2024", "narration": "ACH/CR/TCS_LTD/MONTHLY_SALARY_JAN", "credit": 115000.0})
    rows.append({"date": "05/01/2024", "narration": "UPI/DR/12345/TATA_POWER/ELECTRICITY_BILL", "debit": 3400.0})
    rows.append({"date": "08/01/2024", "narration": "UPI/DR/54321/SOCIETY_MAINTENANCE/MAINT_PAY", "debit": 4500.0})
    # Sudden large property sale advance
    rows.append({"date": "12/01/2024", "narration": "RTGS/CR/SBIN00012/SANJAY_KAPOOR/FLAT_ADVANCE_TOKEN_AMOUNT", "credit": 1800000.0})
    # Held for 6 days, then partial fixed deposit
    rows.append({"date": "18/01/2024", "narration": "FD_BOOKING/DR/ICIC001/TERM_DEPOSIT_CREATE_1YR", "debit": 1200000.0})
    rows.append({"date": "20/01/2024", "narration": "NEFT/DR/AXIS001/LEGAL_REGISTRATION_FEES/STAMP_DUTY", "debit": 150000.0})
    rows.append({"date": "25/01/2024", "narration": "UPI/DR/99881/APOLLO_PHARMACY/MEDICINES", "debit": 1250.0})
    rows.append({"date": "30/01/2024", "narration": "UPI/DR/77665/BIGBASKET/GROCERY_ORDER", "debit": 3400.0})
    
    return header, rows

# ==========================================
# 8. LOW RISK: Clean Salaried Professional (60 txns, ₹4.2L volume)
# ==========================================
def gen_low_risk_salaried():
    header = [
        "Account Statement - HDFC Bank",
        "Account Number: 50100234891100",
        "Account Name: Vikram Malhotra",
        "Branch: Cyber City, Gurgaon",
        "IFSC: HDFC0000542",
        "Statement Period: 01/01/2024 to 31/03/2024"
    ]
    rows = []
    base_date = datetime(2024, 1, 1, 10, 0)
    bal = 145000.0
    rows.append({"date": base_date.strftime("%d/%m/%Y"), "narration": "Opening Balance", "balance": bal})
    
    curr = base_date
    merchants = ["SWIGGY_FOOD", "ZOMATO_ORDER", "AMAZON_INDIA", "UBER_TRIP", "NETFLIX_SUBSCRIPTION", "BIGBASKET", "STARBUCKS_COFFEE", "PETROL_PUMP_IOCL", "CULT_FITNESS_MEMBERSHIP"]
    
    for month in range(1, 4):
        # Salary credit on 1st of month
        sal_date = datetime(2024, month, 1, 11, 0)
        rows.append({
            "date": sal_date.strftime("%d/%m/%Y"),
            "narration": f"NEFT/CR/HDFC0001/INFOSYS_LIMITED/SALARY_CREDIT_MONTH_{month}",
            "credit": 135000.0
        })
        # Rent on 3rd
        rent_date = datetime(2024, month, 3, 14, 0)
        rows.append({
            "date": rent_date.strftime("%d/%m/%Y"),
            "narration": f"UPI/DR/3011{month}/LANDLORD_RENT_TRANSFER/SBIN01/HOUSE_RENT",
            "debit": 35000.0
        })
        # Mutual Fund SIP on 5th
        sip_date = datetime(2024, month, 5, 10, 30)
        rows.append({
            "date": sip_date.strftime("%d/%m/%Y"),
            "narration": f"ACH/DR/NIPPON_INDIA_MUTUAL_FUND/SIP_EQUITY_GROWTH",
            "debit": 20000.0
        })
        # Daily lifestyle transactions
        for day in range(6, 28, 2):
            t_date = datetime(2024, month, day, 12, (day * 3) % 60)
            m = merchants[(day + month) % len(merchants)]
            rows.append({
                "date": t_date.strftime("%d/%m/%Y"),
                "narration": f"UPI/DR/4011{month}{day}/{m}/HDFC00/PAYMENT",
                "debit": 250.0 + ((day * 75) % 1800)
            })

    return header, rows

# ==========================================
# 9. LOW RISK: Student Micro-Transactions (42 txns, ₹35K volume)
# ==========================================
def gen_low_risk_student():
    header = [
        "Account Statement - State Bank of India",
        "Account Number: 20458911234",
        "Account Name: Pooja Sharma (Student Savings)",
        "Branch: IIT Powai Branch, Mumbai",
        "IFSC: SBIN0001109",
        "Statement Period: 01/02/2024 to 28/02/2024"
    ]
    rows = []
    base_date = datetime(2024, 2, 1, 9, 0)
    bal = 2450.0
    rows.append({"date": base_date.strftime("%d/%m/%Y"), "narration": "Opening Balance", "balance": bal})
    
    # Pocket money allowance from father on 1st and 15th
    rows.append({"date": "01/02/2024", "narration": "UPI/CR/201101/FATHER_ALLOWANCE/HDFC001/MONTHLY_POCKET_MONEY", "credit": 8000.0})
    rows.append({"date": "15/02/2024", "narration": "UPI/CR/201115/FATHER_ALLOWANCE/HDFC001/EXAM_EXPENSES", "credit": 4000.0})
    
    # Micro spends: Canteen, xerox, tea, bus
    student_spends = [
        ("CAMPUS_CANTEEN_LUNCH", 85.0),
        ("CHAI_POINT_EVENING", 30.0),
        ("XEROX_PRINT_CENTRE", 45.0),
        ("BOOKSTORE_NOTEBOOKS", 220.0),
        ("BUS_METRO_PASS_RECHARGE", 500.0),
        ("COLLEGE_MESS_FEE", 2500.0),
        ("MOBILE_JIO_RECHARGE", 299.0),
        ("CANTEEN_EVENING_SNACKS", 60.0),
        ("MEDICINE_DISPENSARY", 110.0),
        ("FRIEND_SPLIT_DINNER", 350.0)
    ]
    
    for i in range(1, 38):
        day = 1 + (i % 27)
        sp_name, sp_amt = student_spends[i % len(student_spends)]
        t_date = datetime(2024, 2, day, 11 + (i % 7), (i * 12) % 60)
        rows.append({
            "date": t_date.strftime("%d/%m/%Y"),
            "narration": f"UPI/DR/9022{i:02d}/{sp_name}/PAYTM/CAMPUS_PAY",
            "debit": sp_amt
        })

    return header, rows

# ==========================================
# 10. LOW RISK: Retail Kirana Store Merchant (85 txns, ₹12.4L volume)
# ==========================================
def gen_low_risk_merchant():
    header = [
        "Account Statement - Punjab National Bank",
        "Account Number: 119800210045210",
        "Account Name: Sharma General Stores (Prop. Ramesh Sharma)",
        "Branch: Karol Bagh, New Delhi",
        "IFSC: PUNB0119800",
        "Statement Period: 01/01/2024 to 31/01/2024"
    ]
    rows = []
    base_date = datetime(2024, 1, 1, 8, 0)
    bal = 125000.0
    rows.append({"date": base_date.strftime("%d/%m/%Y"), "narration": "Opening Balance", "balance": bal})
    
    curr = base_date
    for day in range(1, 31):
        # 2-3 customer QR UPI collections per day
        c1 = 1200.0 + ((day * 83) % 2400)
        c2 = 850.0 + ((day * 121) % 1900)
        rows.append({
            "date": f"{day:02d}/01/2024",
            "narration": f"UPI/CR/8811{day:02d}1/CUSTOMER_QR_COLLECTION/BHIM_UPI/GROCERY_PURCHASE",
            "credit": c1
        })
        rows.append({
            "date": f"{day:02d}/01/2024",
            "narration": f"UPI/CR/8811{day:02d}2/CUSTOMER_PAYMENT_POS/PAYTM/STORE_ITEMS",
            "credit": c2
        })
        
        # Weekly distributor payments on Tuesdays & Fridays
        if day in [5, 12, 19, 26]:
            rows.append({
                "date": f"{day:02d}/01/2024",
                "narration": f"NEFT/DR/PUNB0001/HINDUSTAN_UNILEVER_DISTRIBUTOR/FMCG_RESTOCK",
                "debit": 28000.0
            })
            rows.append({
                "date": f"{day:02d}/01/2024",
                "narration": f"IMPS/DR/SBIN0002/AMUL_DAIRY_SUPPLIES/MILK_BUTTER_PURCHASE",
                "debit": 12500.0
            })

    return header, rows

def main():
    target_dir = "/Users/swayam.vernekar/Desktop/CodeAmble/muleguard-local/data/test_statements"
    upload_dir = "/Users/swayam.vernekar/Desktop/CodeAmble/muleguard-local/data/uploads"
    
    generators = [
        # High Risk
        ("01_high_risk_pass_through_mule.csv", gen_high_risk_pass_through),
        ("02_high_risk_circular_mule_ring.csv", gen_high_risk_circular_ring),
        ("03_high_risk_smurfing_structuring.csv", gen_high_risk_smurfing),
        ("04_high_risk_dormant_burst_mule.csv", gen_high_risk_dormant_burst),
        # Medium Risk
        ("05_medium_risk_freelancer_burst.csv", gen_medium_risk_freelancer),
        ("06_medium_risk_odd_hours_merchant.csv", gen_medium_risk_odd_hours),
        ("07_medium_risk_property_advance.csv", gen_medium_risk_property),
        # Low Risk
        ("08_low_risk_salaried_professional.csv", gen_low_risk_salaried),
        ("09_low_risk_student_micro_txns.csv", gen_low_risk_student),
        ("10_low_risk_retail_kirana_merchant.csv", gen_low_risk_merchant),
    ]
    
    for filename, gen_fn in generators:
        header, rows = gen_fn()
        for d in [target_dir, upload_dir]:
            filepath = os.path.join(d, filename)
            create_statement_csv(filepath, header, rows)
            print(f"Generated: {filepath} ({len(rows)} rows)")

if __name__ == "__main__":
    main()
