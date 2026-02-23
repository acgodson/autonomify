use crate::merkle;

/// Check if recipient is in the whitelist (Merkle Tree)
/// Generic over depth N
pub fn check_whitelist<let N: u32>(
    recipient: Field, 
    root: Field, 
    path: [Field; N], 
    index: Field
) -> bool {
    merkle::check_membership(root, recipient, index, path)
}
