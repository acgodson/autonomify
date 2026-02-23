use std;

/// Compute the Merkle root from a leaf, index, and hash path.
/// This implementation is generic over the depth N.
pub fn compute_merkle_root<let N: u32>(leaf: Field, index: Field, hash_path: [Field; N]) -> Field {
    let mut current = leaf;
    // Use turbofish syntax to specify the size of the output array
    let idx_bits: [u1; 32] = index.to_le_bits();

    for i in 0..N {
        let path_element = hash_path[i];
        let bit = idx_bits[i];

        if bit == 0 {
            current = std::hash::pedersen_hash([current, path_element]);
        } else {
            current = std::hash::pedersen_hash([path_element, current]);
        }
    }
    current
}

/// Check if a leaf is a member of the Merkle tree defined by the root.
pub fn check_membership<let N: u32>(root: Field, leaf: Field, index: Field, hash_path: [Field; N]) -> bool {
    let computed_root = compute_merkle_root(leaf, index, hash_path);
    computed_root == root
}
