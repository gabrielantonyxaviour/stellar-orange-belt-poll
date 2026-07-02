#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short, Address, Env, String, Vec,
};

#[contractclient(name = "RewardTokenClient")]
pub trait RewardToken {
    fn mint(env: Env, to: Address, amount: i128);
}

#[derive(Clone)]
#[contracttype]
pub struct Poll {
    question: String,
    options: Vec<String>,
    counts: Vec<u32>,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    RewardToken,
    NextPollId,
    Poll(u64),
    Voted(u64, Address),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracterror]
#[repr(u32)]
pub enum PollError {
    PollNotFound = 1,
    InvalidOption = 2,
    AlreadyVoted = 3,
    NoOptions = 4,
    RewardTokenNotSet = 5,
    RewardTokenAlreadySet = 6,
}

#[contract]
pub struct PollContract;

#[contractimpl]
impl PollContract {
    pub fn __constructor(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
    }

    pub fn set_reward_token(env: Env, address: Address) {
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if env.storage().persistent().has(&DataKey::RewardToken) {
            panic_with_error!(&env, PollError::RewardTokenAlreadySet);
        }

        env.storage()
            .persistent()
            .set(&DataKey::RewardToken, &address);
    }

    pub fn create_poll(env: Env, question: String, options: Vec<String>) -> u64 {
        if options.is_empty() {
            panic_with_error!(&env, PollError::NoOptions);
        }

        let poll_id = env
            .storage()
            .persistent()
            .get(&DataKey::NextPollId)
            .unwrap_or(1_u64);

        let mut counts = Vec::new(&env);
        for _option in options.iter() {
            counts.push_back(0);
        }

        let poll = Poll {
            question,
            options,
            counts,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Poll(poll_id), &poll);
        env.storage()
            .persistent()
            .set(&DataKey::NextPollId, &(poll_id + 1));

        poll_id
    }

    pub fn vote(env: Env, poll_id: u64, voter: Address, option_index: u32) {
        voter.require_auth();

        let voted_key = DataKey::Voted(poll_id, voter.clone());
        if env.storage().persistent().has(&voted_key) {
            panic_with_error!(&env, PollError::AlreadyVoted);
        }

        let poll_key = DataKey::Poll(poll_id);
        let mut poll: Poll = env
            .storage()
            .persistent()
            .get(&poll_key)
            .unwrap_or_else(|| panic_with_error!(&env, PollError::PollNotFound));

        if option_index >= poll.counts.len() {
            panic_with_error!(&env, PollError::InvalidOption);
        }

        let current_count = poll
            .counts
            .get(option_index)
            .unwrap_or_else(|| panic_with_error!(&env, PollError::InvalidOption));
        poll.counts.set(option_index, current_count + 1);

        env.storage().persistent().set(&poll_key, &poll);
        env.storage().persistent().set(&voted_key, &true);
        env.events()
            .publish((symbol_short!("vote"), poll_id), option_index);

        let reward_token: Address = env
            .storage()
            .persistent()
            .get(&DataKey::RewardToken)
            .unwrap_or_else(|| panic_with_error!(&env, PollError::RewardTokenNotSet));
        let reward_client = RewardTokenClient::new(&env, &reward_token);
        reward_client.mint(&voter, &1_i128);
    }

    pub fn get_results(env: Env, poll_id: u64) -> Vec<u32> {
        let poll: Poll = env
            .storage()
            .persistent()
            .get(&DataKey::Poll(poll_id))
            .unwrap_or_else(|| panic_with_error!(&env, PollError::PollNotFound));

        poll.counts
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use reward_token::{RewardTokenContract, RewardTokenContractClient};
    use soroban_sdk::{testutils::Address as _, vec};

    fn setup(env: &Env) -> (PollContractClient<'_>, RewardTokenContractClient<'_>) {
        env.mock_all_auths();

        let admin = Address::generate(env);
        let reward_id = env.register(RewardTokenContract, (&admin,));
        let poll_id = env.register(PollContract, (&admin,));
        let reward = RewardTokenContractClient::new(env, &reward_id);
        let poll = PollContractClient::new(env, &poll_id);

        reward.set_minter(&poll_id);
        poll.set_reward_token(&reward_id);

        (poll, reward)
    }

    fn create_default_poll(env: &Env, poll: &PollContractClient<'_>) -> u64 {
        let options = vec![
            env,
            String::from_str(env, "Stellar CLI"),
            String::from_str(env, "Soroban SDK"),
            String::from_str(env, "Stellar Expert"),
            String::from_str(env, "Freighter"),
        ];
        poll.create_poll(
            &String::from_str(env, "Which Stellar tool do you use most?"),
            &options,
        )
    }

    #[test]
    fn vote_records_correctly_and_increments_selected_option() {
        let env = Env::default();
        let (poll, _reward) = setup(&env);
        let poll_id = create_default_poll(&env, &poll);
        let voter = Address::generate(&env);

        poll.vote(&poll_id, &voter, &1_u32);

        let results = poll.get_results(&poll_id);
        assert_eq!(results.get(0).unwrap(), 0);
        assert_eq!(results.get(1).unwrap(), 1);
        assert_eq!(results.get(2).unwrap(), 0);
        assert_eq!(results.get(3).unwrap(), 0);
    }

    #[test]
    #[should_panic]
    fn double_vote_from_same_address_rejects() {
        let env = Env::default();
        let (poll, _reward) = setup(&env);
        let poll_id = create_default_poll(&env, &poll);
        let voter = Address::generate(&env);

        poll.vote(&poll_id, &voter, &0_u32);
        poll.vote(&poll_id, &voter, &1_u32);
    }

    #[test]
    fn successful_vote_mints_one_reward_token_to_voter() {
        let env = Env::default();
        let (poll, reward) = setup(&env);
        let poll_id = create_default_poll(&env, &poll);
        let voter = Address::generate(&env);

        assert_eq!(reward.balance(&voter), 0_i128);

        poll.vote(&poll_id, &voter, &2_u32);

        assert_eq!(reward.balance(&voter), 1_i128);
    }
}
