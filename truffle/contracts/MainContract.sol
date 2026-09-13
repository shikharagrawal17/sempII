// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

/**
 * @title MainContract
 * @dev Decentralized NGO Verification, Enrollment, and Transparent Donation Platform.
 */
contract MainContract {

    address public owner;

    struct NGO {
        string name;
        string description;
        address payable wallet;
        uint256 registrationNumber;
        uint256 upvotes;
        uint256 totalDonationsReceived;
        bool isEnrolled;
    }

    struct AuthorizedNGO {
        uint256 registrationNumber;
        address wallet;
        bool isAuthorized;
    }

    struct DonationRecord {
        uint256 registrationNumber;
        string ngoName;
        address ngoWallet;
        uint256 amount;
        uint256 timestamp;
    }

    // Storage
    mapping(address => DonationRecord[]) private donationRecords;
    mapping(uint256 => AuthorizedNGO) public authorizedNGOs;
    mapping(uint256 => NGO) public enrolledNGOsByReg;
    mapping(address => mapping(uint256 => bool)) public hasUpvoted;

    uint256[] public authorizedRegNumbers;
    uint256[] public enrolledRegNumbers;
    address[] public donorAddresses;
    mapping(address => bool) private isDonor;

    uint256 public totalDonationsCount;
    uint256 public totalETHDonated;

    // Events
    event NGOAuthorized(uint256 indexed registrationNumber, address indexed wallet);
    event NGOEnrolled(uint256 indexed registrationNumber, string name, address indexed wallet);
    event DonationReceived(address indexed donor, address indexed ngoWallet, uint256 indexed registrationNumber, uint256 amount, uint256 timestamp);
    event NGOUpvoted(address indexed user, uint256 indexed registrationNumber, uint256 newUpvoteTotal);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Authorize an NGO registration number and designated wallet address (Admin only)
     */
    function addToAuthorizedNGO(uint256 registrationNumber, address wallet) public onlyOwner {
        require(registrationNumber > 0, "Invalid registration number");
        require(wallet != address(0), "Invalid wallet address");
        require(!authorizedNGOs[registrationNumber].isAuthorized, "NGO already authorized");

        authorizedNGOs[registrationNumber] = AuthorizedNGO({
            registrationNumber: registrationNumber,
            wallet: wallet,
            isAuthorized: true
        });

        authorizedRegNumbers.push(registrationNumber);
        emit NGOAuthorized(registrationNumber, wallet);
    }

    /**
     * @dev NGO wallet enrolls with name & description after being pre-authorized
     */
    function enrollAsNGO(
        string memory name,
        string memory description,
        address payable wallet,
        uint256 registrationNumber
    ) external {
        require(msg.sender == wallet, "Sender must match NGO wallet address");
        require(authorizedNGOs[registrationNumber].isAuthorized, "NGO registration number not authorized");
        require(authorizedNGOs[registrationNumber].wallet == wallet, "Wallet not authorized for this registration number");
        require(!enrolledNGOsByReg[registrationNumber].isEnrolled, "NGO is already enrolled");

        NGO memory newNGO = NGO({
            name: name,
            description: description,
            wallet: wallet,
            registrationNumber: registrationNumber,
            upvotes: 0,
            totalDonationsReceived: 0,
            isEnrolled: true
        });

        enrolledNGOsByReg[registrationNumber] = newNGO;
        enrolledRegNumbers.push(registrationNumber);

        emit NGOEnrolled(registrationNumber, name, wallet);
    }

    /**
     * @dev Donate ETH directly to an enrolled NGO
     */
    function donate(uint256 registrationNumber) public payable {
        require(msg.value > 0, "Donation amount must be greater than 0");
        require(enrolledNGOsByReg[registrationNumber].isEnrolled, "Target NGO is not enrolled");

        NGO storage targetNGO = enrolledNGOsByReg[registrationNumber];
        address payable ngoWallet = targetNGO.wallet;
        require(ngoWallet != address(0), "Invalid recipient wallet");

        // Forward ETH safely to NGO wallet
        (bool success, ) = ngoWallet.call{value: msg.value}("");
        require(success, "Transfer to NGO failed");

        targetNGO.totalDonationsReceived += msg.value;
        totalETHDonated += msg.value;
        totalDonationsCount++;

        // Track donor
        if (!isDonor[msg.sender]) {
            isDonor[msg.sender] = true;
            donorAddresses.push(msg.sender);
        }

        DonationRecord memory record = DonationRecord({
            registrationNumber: registrationNumber,
            ngoName: targetNGO.name,
            ngoWallet: ngoWallet,
            amount: msg.value,
            timestamp: block.timestamp
        });

        donationRecords[msg.sender].push(record);

        emit DonationReceived(msg.sender, ngoWallet, registrationNumber, msg.value, block.timestamp);
    }

    /**
     * @dev Upvote a verified NGO to promote community trust
     */
    function upvoteNGO(uint256 registrationNumber) public {
        require(enrolledNGOsByReg[registrationNumber].isEnrolled, "NGO is not enrolled");
        require(!hasUpvoted[msg.sender][registrationNumber], "You have already upvoted this NGO");

        hasUpvoted[msg.sender][registrationNumber] = true;
        enrolledNGOsByReg[registrationNumber].upvotes += 1;

        emit NGOUpvoted(msg.sender, registrationNumber, enrolledNGOsByReg[registrationNumber].upvotes);
    }

    /**
     * @dev Get all enrolled NGOs
     */
    function getNGOList() external view returns (NGO[] memory) {
        uint256 count = enrolledRegNumbers.length;
        NGO[] memory list = new NGO[](count);
        for (uint256 i = 0; i < count; i++) {
            list[i] = enrolledNGOsByReg[enrolledRegNumbers[i]];
        }
        return list;
    }

    /**
     * @dev Get all donation records for the caller
     */
    function myDonations() external view returns (DonationRecord[] memory) {
        return donationRecords[msg.sender];
    }

    /**
     * @dev Get all unique donor addresses
     */
    function getDonors() external view returns (address[] memory) {
        return donorAddresses;
    }

    /**
     * @dev Get list of authorized registration numbers
     */
    function getAuthorizedRegNumbers() external view returns (uint256[] memory) {
        return authorizedRegNumbers;
    }

    function getOwner() public view returns (address) {
        return owner;
    }

    function changeOwner(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "Invalid new owner");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
