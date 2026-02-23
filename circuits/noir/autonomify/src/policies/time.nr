/// Check if current hour is within allowed time window
pub fn check_time_window(current_hour: u64, start_hour: u64, end_hour: u64) -> bool {
    if start_hour <= end_hour {
        // Normal case: e.g., 9am to 5pm
        (current_hour >= start_hour) & (current_hour < end_hour)
    } else {
        // Wrap-around case: e.g., 10pm to 2am
        (current_hour >= start_hour) | (current_hour < end_hour)
    }
}
