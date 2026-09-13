# 🌟 sempII - Decentralized Web3 NGO Philanthropy & Transparent Donations

A decentralized, trustless, and zero-intermediary charity platform built on **Ethereum**, **Solidity**, **Ethers.js**, and **Tailwind CSS**.

`sempII` ensures 100% transparent donation flows by validating authorized non-profit organizations on-chain and routing cryptocurrency donations directly to the verified NGO's destination wallet with immutable receipts.

---

## ✨ Features

- 🔐 **On-Chain NGO Whitelisting & Verification**: Only government-authorized registration numbers pre-approved by the smart contract owner can complete enrollment.
- 💸 **Direct Peer-to-Contract Donations**: 0% platform fee. 100% of the donor's ETH is transferred directly to the designated NGO wallet.
- 📊 **Real-time Donor Dashboard & Receipts**: Donors can inspect their complete history with timestamp, recipient address, and transaction hash.
- 🗳️ **Community Upvoting**: Donors and community members can upvote verified NGOs to promote trustworthy initiatives.
- 🔍 **Dynamic Discovery & Search**: Filter NGOs by category (*Healthcare, Education, Climate, Hunger, Animals*) or search by keywords and registration numbers.
- ⚡ **Dual Execution Engine**:
  - **Live Web3 Mode**: Direct MetaMask wallet connection + Ethers.js smart contract interaction.
  - **Interactive Demo Mode**: Instant browser simulation mode for testing, reviews, and presentations with zero setup and zero gas costs.

---

## 🏗️ Architecture

```
sempII/
├── index.html           # Main Application SPA (Glassmorphic Dark Mode)
├── script.js           # Ethers.js integration, Web3 Wallet connector & state management
├── style.css           # Glassmorphism tokens, custom animations & typography
└── truffle/
    ├── contracts/
    │   └── MainContract.sol   # Solidity Smart Contract (NGO Auth, Donations, Upvoting)
    ├── migrations/            # Deployment scripts
    ├── test/                  # Contract unit tests
    └── truffle-config.js      # Truffle network configuration
```

---

## 🚀 Getting Started

### 1. Run the Frontend Locally

No build tools or Node dependencies are required to preview the frontend!

You can serve `index.html` using any static file server:

```bash
# Using Python
python3 -m http.server 8080

# Or using npx serve
npx serve .
```

Then open `http://localhost:8080` in your browser.

---

### 2. Smart Contract Development & Deployment

To compile and deploy the smart contract to a local testnet or Ethereum testnet (e.g. Sepolia):

```bash
cd truffle

# Install Truffle dependencies
npm install

# Compile contracts
npx truffle compile

# Run tests
npx truffle test

# Deploy to local development network (Ganache)
npx truffle migrate --network development
```

---

## 📜 Smart Contract Overview (`MainContract.sol`)

- `addToAuthorizedNGO(uint256 regNumber, address wallet)`: Whitelists an NGO registration number and designated recipient wallet. *(Admin only)*
- `enrollAsNGO(string name, string description, address wallet, uint256 regNumber)`: Allows an authorized NGO to finalize on-chain registration.
- `donate(uint256 regNumber)`: Payable function that safely forwards ETH to the NGO and records donor history.
- `upvoteNGO(uint256 regNumber)`: Allows community members to upvote enrolled NGOs.
- `getNGOList()`: Returns all active enrolled NGOs.
- `myDonations()`: Returns the sender's personalized donation history.

---

## 🛠️ Tech Stack

- **Smart Contracts**: Solidity `>=0.4.22 <0.9.0`, Truffle Framework
- **Web3 Integration**: Ethers.js v5.7, MetaMask Provider (`window.ethereum`)
- **Frontend UI**: HTML5, Modern CSS3 Glassmorphism, Tailwind CSS, Lucide Icons, Plus Jakarta Sans Font

---

## 📄 License
MIT License. Open source and free to use for charitable initiatives.
