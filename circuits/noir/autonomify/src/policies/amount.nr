/// Check if transaction amount is within the allowed limit
pub fn check_max_amount(amount: u64, max_limit: u64) -> bool {
    amount <= max_limit
}
