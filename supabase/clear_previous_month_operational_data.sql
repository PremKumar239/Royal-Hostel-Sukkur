-- Clear PREVIOUS calendar month operational rows (Asia/Karachi).
-- Keeps: students, rooms, unpaid fees, month_closures snapshots (download reports).
-- Deletes: paid fees, expenses, ledger, mess, van, admission, outside mess for that month.
--
-- Run in Supabase SQL Editor AFTER monthly closing has created snapshots.
-- This cannot be undone.

DO $$
DECLARE
  v_tz text := 'Asia/Karachi';
  v_current date;
  v_prev date;
  v_end date;
  v_closed_count int;
BEGIN
  v_current := date_trunc('month', (now() AT TIME ZONE v_tz))::date;
  v_prev := (v_current - interval '1 month')::date;
  v_end := (v_prev + interval '1 month' - interval '1 day')::date;

  SELECT count(*) INTO v_closed_count
  FROM month_closures
  WHERE billing_month = v_prev;

  IF v_closed_count = 0 THEN
    RAISE EXCEPTION
      'No closed report for %. Run SELECT public.auto_close_all_hostels_cron(); first.',
      v_prev;
  END IF;

  RAISE NOTICE 'Clearing operational data for billing month % (through %)', v_prev, v_end;

  ALTER TABLE fee_records DISABLE TRIGGER trg_fee_records_closed_month;
  ALTER TABLE expenses DISABLE TRIGGER trg_expenses_closed_month;
  ALTER TABLE mess_expenses DISABLE TRIGGER trg_mess_expenses_closed;
  ALTER TABLE van_payments DISABLE TRIGGER trg_van_payments_closed;
  ALTER TABLE van_expenses DISABLE TRIGGER trg_van_expenses_closed;
  ALTER TABLE outside_mess_payments DISABLE TRIGGER trg_outside_mess_closed;
  ALTER TABLE admission_fees DISABLE TRIGGER trg_admission_fees_closed;

  -- Keep unpaid invoices so outstanding fees can still be collected in the new month
  DELETE FROM fee_records
  WHERE billing_month = v_prev
    AND status = 'paid';

  DELETE FROM expenses
  WHERE expense_date BETWEEN v_prev AND v_end;

  DELETE FROM mess_expenses
  WHERE billing_month = v_prev;

  DELETE FROM van_payments
  WHERE billing_month = v_prev;

  DELETE FROM van_expenses
  WHERE billing_month = v_prev;

  DELETE FROM outside_mess_payments
  WHERE billing_month = v_prev;

  DELETE FROM admission_fees
  WHERE payment_date BETWEEN v_prev AND v_end;

  ALTER TABLE fee_records ENABLE TRIGGER trg_fee_records_closed_month;
  ALTER TABLE expenses ENABLE TRIGGER trg_expenses_closed_month;
  ALTER TABLE mess_expenses ENABLE TRIGGER trg_mess_expenses_closed;
  ALTER TABLE van_payments ENABLE TRIGGER trg_van_payments_closed;
  ALTER TABLE van_expenses ENABLE TRIGGER trg_van_expenses_closed;
  ALTER TABLE outside_mess_payments ENABLE TRIGGER trg_outside_mess_closed;
  ALTER TABLE admission_fees ENABLE TRIGGER trg_admission_fees_closed;
END $$;
