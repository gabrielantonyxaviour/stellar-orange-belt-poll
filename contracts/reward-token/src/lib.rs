#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Minter,
    Balance(Address),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracterror]
#[repr(u32)]
pub enum RewardTokenError {
    MinterAlreadySet = 1,
    MinterNotSet = 2,
    InvalidAmount = 3,
}

#[contract]
pub struct RewardTokenContract;

#[contractimpl]
impl RewardTokenContract {
    pub fn __constructor(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
    }

    pub fn set_minter(env: Env, minter: Address) {
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if env.storage().persistent().has(&DataKey::Minter) {
            panic_with_error!(&env, RewardTokenError::MinterAlreadySet);
        }

        env.storage().persistent().set(&DataKey::Minter, &minter);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, RewardTokenError::InvalidAmount);
        }

        let minter: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Minter)
            .unwrap_or_else(|| panic_with_error!(&env, RewardTokenError::MinterNotSet));
        minter.require_auth();

        let balance_key = DataKey::Balance(to);
        let current = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0_i128);
        env.storage()
            .persistent()
            .set(&balance_key, &(current + amount));
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0_i128)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn admin_sets_minter_once_and_minter_mints_balance() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let minter = Address::generate(&env);
        let voter = Address::generate(&env);
        let contract_id = env.register(RewardTokenContract, (&admin,));
        let client = RewardTokenContractClient::new(&env, &contract_id);

        client.set_minter(&minter);
        client.mint(&voter, &1_i128);

        assert_eq!(client.balance(&voter), 1_i128);
    }

    #[test]
    #[should_panic]
    fn minter_cannot_be_changed_after_it_is_set() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let minter = Address::generate(&env);
        let next_minter = Address::generate(&env);
        let contract_id = env.register(RewardTokenContract, (&admin,));
        let client = RewardTokenContractClient::new(&env, &contract_id);

        client.set_minter(&minter);
        client.set_minter(&next_minter);
    }
}
