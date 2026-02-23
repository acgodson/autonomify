// Supports multiple policies: max amount, time window, recipient whitelist

use std;

mod merkle;
mod policies;

pub fn main(
    // Transaction data (private)
    tx_amount: u64,
    tx_recipient: Field,
    tx_timestamp: u64,
    // Policy parameters (private)
    max_amount: u64,
    allowed_start_hour: u64,
    allowed_end_hour: u64,
    // Whitelist parameters (private)
    whitelist_root: Field,
    whitelist_path: [Field; 2], // Depth 2
    whitelist_index: Field,
    // Policy enable flags (private)
    enable_max_amount: bool,
    enable_time_window: bool,
    enable_whitelist: bool,
    // Public outputs
    policy_satisfied: pub Field,
    nullifier: pub Field,
    user_address_hash: pub Field,
) {
    // ========================================================================
    // Policy Checks (conditionally executed based on enable flags)
    // ========================================================================

    // Check max amount policy
    let max_amount_ok = if enable_max_amount {
        policies::amount::check_max_amount(tx_amount, max_amount)
    } else {
        true
    };

    // Check time window policy
    let time_ok = if enable_time_window {
        // Extract hour from timestamp (assuming Unix timestamp in seconds)
        let current_hour = (tx_timestamp / 3600) % 24;
        policies::time::check_time_window(current_hour, allowed_start_hour, allowed_end_hour)
    } else {
        true
    };

    // Check whitelist policy
    let whitelist_ok = if enable_whitelist {
        policies::whitelist::check_whitelist(
            tx_recipient,
            whitelist_root,
            whitelist_path,
            whitelist_index,
        )
    } else {
        true
    };

    assert(max_amount_ok & time_ok & whitelist_ok);

    let nullifier_inputs: [Field; 4] =
        [tx_timestamp as Field, tx_recipient, tx_amount as Field, user_address_hash];

    let computed_nullifier = std::hash::pedersen_hash(nullifier_inputs);

    assert(nullifier == computed_nullifier);

    assert(policy_satisfied == 1);
}

// #[test]
// fn test_max_amount_pass() {
//     assert(policies::amount::check_max_amount(50, 100));
// }

// #[test]
// fn test_max_amount_fail() {
//     assert(!policies::amount::check_max_amount(150, 100));
// }

// #[test]
// fn test_time_window_normal() {
//     assert(policies::time::check_time_window(10, 9, 17)); // 10am in 9am-5pm window
//     assert(!policies::time::check_time_window(8, 9, 17)); // 8am outside window
// }

// #[test]
// fn test_time_window_wraparound() {
//     assert(policies::time::check_time_window(23, 22, 2)); // 11pm in 10pm-2am window
//     assert(policies::time::check_time_window(1, 22, 2)); // 1am in 10pm-2am window
//     assert(!policies::time::check_time_window(3, 22, 2)); // 3am outside window
// }
