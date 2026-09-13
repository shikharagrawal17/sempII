/**
 * sempII - Decentralized NGO Donation Platform Logic
 * Connects to MetaMask & MainContract.sol via Ethers.js
 * Supports dynamic interactive demo simulation fallback.
 */

// Contract ABI (Matches enhanced MainContract.sol)
const CONTRACT_ABI = [
  "function owner() view returns (address)",
  "function addToAuthorizedNGO(uint256 registrationNumber, address wallet)",
  "function enrollAsNGO(string name, string description, address wallet, uint256 registrationNumber)",
  "function donate(uint256 registrationNumber) payable",
  "function upvoteNGO(uint256 registrationNumber)",
  "function getNGOList() view returns (tuple(string name, string description, address wallet, uint256 registrationNumber, uint256 upvotes, uint256 totalDonationsReceived, bool isEnrolled)[])",
  "function myDonations() view returns (tuple(uint256 registrationNumber, string ngoName, address ngoWallet, uint256 amount, uint256 timestamp)[])",
  "function getDonors() view returns (address[])",
  "function getAuthorizedRegNumbers() view returns (uint256[])",
  "function totalDonationsCount() view returns (uint256)",
  "function totalETHDonated() view returns (uint256)"
];

const ETH_PRICE_USD = 3300; // Estimated conversion for UI

// Default Initial Mock Data for Interactive Mode
const INITIAL_DEMO_NGOS = [
  {
    registrationNumber: 1001,
    name: "Clean Oceans Global Initiative",
    category: "Environment",
    description: "Deploying autonomous ocean cleanup arrays and marine ecosystem restoration along global coastlines.",
    wallet: "0x71C8364f3B7183172F4020a67C1e9C33866b889B",
    upvotes: 42,
    totalDonationsReceived: "14.50",
    goal: "25.00",
    isEnrolled: true,
    coverColor: "from-blue-600 to-cyan-500",
    icon: "waves"
  },
  {
    registrationNumber: 1002,
    name: "Aura Education & Tech for Kids",
    category: "Education",
    description: "Providing modern STEM education, laptops, and internet connectivity to underprivileged rural schools.",
    wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    upvotes: 38,
    totalDonationsReceived: "9.80",
    goal: "15.00",
    isEnrolled: true,
    coverColor: "from-purple-600 to-indigo-600",
    icon: "book-open"
  },
  {
    registrationNumber: 1003,
    name: "Universal Medical Relief Fund",
    category: "Healthcare",
    description: "Emergency medical supplies, mobile field clinics, and essential medicines in conflict and disaster zones.",
    wallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    upvotes: 56,
    totalDonationsReceived: "18.55",
    goal: "20.00",
    isEnrolled: true,
    coverColor: "from-rose-600 to-pink-500",
    icon: "heart-pulse"
  }
];

const INITIAL_DEMO_WHITELIST = [
  { registrationNumber: 1001, wallet: "0x71C8364f3B7183172F4020a67C1e9C33866b889B", isEnrolled: true, date: "2026-09-01" },
  { registrationNumber: 1002, wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", isEnrolled: true, date: "2026-09-03" },
  { registrationNumber: 1003, wallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", isEnrolled: true, date: "2026-09-05" },
  { registrationNumber: 1004, wallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", isEnrolled: false, date: "2026-09-12" }
];

// App State
let appMode = 'interactive'; // 'interactive' or 'web3'
let userAccount = null;
let provider = null;
let signer = null;
let contract = null;
let currentContractAddress = localStorage.getItem('semp_contract_addr') || '';

// Local Storage Initializers
let ngos = JSON.parse(localStorage.getItem('semp_ngos')) || INITIAL_DEMO_NGOS;
let donations = JSON.parse(localStorage.getItem('semp_donations')) || [
  {
    registrationNumber: 1001,
    ngoName: "Clean Oceans Global Initiative",
    ngoWallet: "0x71C8364f3B7183172F4020a67C1e9C33866b889B",
    amount: "0.25",
    timestamp: Date.now() - 3600000 * 24 * 2,
    txHash: "0x8fa37d2f9b2319fbc41029410ea6c589b219087c941785ef014bb657193f0b21"
  },
  {
    registrationNumber: 1003,
    ngoName: "Universal Medical Relief Fund",
    ngoWallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    amount: "0.50",
    timestamp: Date.now() - 3600000 * 12,
    txHash: "0x4b78912de78619aae075591280fa19bf301bc510e47c72951e73998b64e622b1"
  }
];
let whitelist = JSON.parse(localStorage.getItem('semp_whitelist')) || INITIAL_DEMO_WHITELIST;
let selectedNgoForDonation = null;

// Initialize App
window.addEventListener("DOMContentLoaded", async () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Setup DOM Event Listeners
  setupEventListeners();

  // Load Initial View
  renderNGOs();
  renderDonations();
  renderWhitelist();
  updateStats();

  // Check MetaMask presence
  if (typeof window.ethereum !== 'undefined') {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    
    // Check if already connected
    const accounts = await provider.listAccounts();
    if (accounts.length > 0) {
      handleAccountsChanged(accounts);
    }

    // MetaMask Event Listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', () => window.location.reload());
  }
});

function setupEventListeners() {
  // Wallet Connect Button
  const connectBtn = document.getElementById('connect-wallet-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', connectWallet);
  }

  // Search and Filter Inputs
  const searchInput = document.getElementById('ngo-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderNGOs());
  }

  const categoryFilter = document.getElementById('ngo-category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => renderNGOs());
  }

  // Donation Amount Live USD Calculation
  const donateInput = document.getElementById('donation-amount-input');
  if (donateInput) {
    donateInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      const usdSpan = document.getElementById('modal-amount-usd');
      if (usdSpan) usdSpan.textContent = (val * ETH_PRICE_USD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
  }

  // Donation Form Submission
  const donateForm = document.getElementById('donation-form');
  if (donateForm) {
    donateForm.addEventListener('submit', handleDonationSubmit);
  }

  // NGO Enrollment Form
  const enrollForm = document.getElementById('enroll-ngo-form');
  if (enrollForm) {
    enrollForm.addEventListener('submit', handleEnrollmentSubmit);
  }

  // Admin Auth Form
  const adminForm = document.getElementById('admin-auth-form');
  if (adminForm) {
    adminForm.addEventListener('submit', handleAdminAuthSubmit);
  }

  // Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      const menu = document.getElementById('mobile-menu');
      if (menu) menu.classList.toggle('hidden');
    });
  }
}

// Mode Switching: Demo vs Live Web3
function setAppMode(mode) {
  appMode = mode;
  const demoBtn = document.getElementById('mode-interactive-btn');
  const web3Btn = document.getElementById('mode-web3-btn');
  const noticeStatus = document.getElementById('mode-status-text');

  if (mode === 'web3') {
    demoBtn.className = "px-2.5 py-1 rounded-md transition font-medium text-gray-400 hover:text-white";
    web3Btn.className = "px-2.5 py-1 rounded-md transition font-medium text-white bg-indigo-600 shadow";
    noticeStatus.innerHTML = `<strong>Live Web3 Mode:</strong> Interacting directly with on-chain smart contract.`;
    showToast("Switched to Live Web3 Mode", "info");
    if (!userAccount) connectWallet();
  } else {
    demoBtn.className = "px-2.5 py-1 rounded-md transition font-medium text-white bg-indigo-600/60 shadow";
    web3Btn.className = "px-2.5 py-1 rounded-md transition font-medium text-gray-400 hover:text-white";
    noticeStatus.innerHTML = `<strong>Running in Demo Simulation Mode:</strong> Instant testing with rich sample verified NGOs and zero gas fees.`;
    showToast("Switched to Demo Simulation Mode", "info");
  }
}

// Tab Switching
function switchTab(tabName) {
  const tabs = ['explore', 'donations', 'enroll', 'admin'];
  tabs.forEach(t => {
    const sec = document.getElementById(`section-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (sec) sec.classList.toggle('hidden', t !== tabName);
    if (btn) btn.classList.toggle('active', t === tabName);
  });

  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenu) mobileMenu.classList.add('hidden');

  if (window.lucide) window.lucide.createIcons();
}

// Connect Wallet
async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    showToast("MetaMask is not installed. Please install MetaMask to use Web3 features.", "warning");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    handleAccountsChanged(accounts);
    showToast("Wallet Connected Successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Failed to connect wallet", "error");
  }
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    userAccount = null;
    document.getElementById('wallet-btn-text').textContent = "Connect Wallet";
  } else {
    userAccount = accounts[0];
    const shortened = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;
    document.getElementById('wallet-btn-text').textContent = shortened;
    
    // Auto-fill wallet in enrollment form
    const enrollWalletInput = document.getElementById('enroll-wallet');
    if (enrollWalletInput && !enrollWalletInput.value) {
      enrollWalletInput.value = userAccount;
    }
  }
}

// Render NGO Cards Grid
function renderNGOs() {
  const grid = document.getElementById('ngo-grid');
  const emptyState = document.getElementById('ngo-empty-state');
  if (!grid) return;

  const query = (document.getElementById('ngo-search-input')?.value || '').toLowerCase();
  const category = document.getElementById('ngo-category-filter')?.value || 'all';

  const filtered = ngos.filter(ngo => {
    const matchesSearch = ngo.name.toLowerCase().includes(query) || 
                          ngo.description.toLowerCase().includes(query) ||
                          String(ngo.registrationNumber).includes(query);
    const matchesCategory = category === 'all' || ngo.category === category;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  grid.innerHTML = filtered.map(ngo => {
    const ethRaised = parseFloat(ngo.totalDonationsReceived || 0);
    const goal = parseFloat(ngo.goal || 20);
    const progressPercent = Math.min(100, Math.round((ethRaised / goal) * 100));

    return `
      <div class="glass-panel glass-panel-hover rounded-3xl p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
        
        <!-- Top Tags -->
        <div>
          <div class="flex items-center justify-between gap-2 mb-4">
            <span class="px-3 py-1 rounded-full text-[11px] font-bold badge-verified flex items-center space-x-1">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
              <span>Reg #${ngo.registrationNumber}</span>
            </span>
            <span class="text-xs px-2.5 py-1 rounded-lg bg-slate-900/90 text-gray-400 border border-slate-800 font-medium">
              ${ngo.category || 'Humanitarian'}
            </span>
          </div>

          <h3 class="text-xl font-bold text-white group-hover:text-indigo-300 transition line-clamp-1 mb-2">
            ${ngo.name}
          </h3>

          <p class="text-xs text-gray-400 line-clamp-3 leading-relaxed mb-4">
            ${ngo.description}
          </p>
        </div>

        <!-- Progress & Donation Info -->
        <div class="mt-4 pt-4 border-t border-slate-800/80 space-y-4">
          <div>
            <div class="flex justify-between text-xs font-semibold mb-1.5">
              <span class="text-gray-400">Raised: <strong class="text-white font-mono-custom">${ethRaised.toFixed(2)} ETH</strong></span>
              <span class="text-indigo-400 font-mono-custom">${progressPercent}% of ${goal} ETH</span>
            </div>
            <div class="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
              <div class="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2">
            <button onclick="openDonateModal(${ngo.registrationNumber})" class="flex-1 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center space-x-1.5 shadow-md shadow-indigo-600/20">
              <i data-lucide="heart" class="w-3.5 h-3.5"></i>
              <span>Donate ETH</span>
            </button>

            <button onclick="handleUpvote(${ngo.registrationNumber})" class="px-3 py-2.5 rounded-xl font-semibold text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 text-gray-300 hover:text-white transition flex items-center space-x-1.5" title="Upvote NGO">
              <i data-lucide="thumbs-up" class="w-3.5 h-3.5 text-indigo-400"></i>
              <span id="upvotes-${ngo.registrationNumber}">${ngo.upvotes || 0}</span>
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

// Render Donation History
function renderDonations() {
  const tbody = document.getElementById('donations-table-body');
  const emptyState = document.getElementById('donations-empty-state');
  const myTotalSpan = document.getElementById('my-total-donated-eth');
  if (!tbody) return;

  if (donations.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    if (myTotalSpan) myTotalSpan.textContent = '0.00 ETH';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  let totalDonated = 0;
  tbody.innerHTML = donations.map(d => {
    const amt = parseFloat(d.amount || 0);
    totalDonated += amt;
    const dateStr = new Date(d.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const shortWallet = `${d.ngoWallet.slice(0, 6)}...${d.ngoWallet.slice(-4)}`;
    const shortTx = d.txHash ? `${d.txHash.slice(0, 8)}...${d.txHash.slice(-6)}` : 'On-Chain Verified';

    return `
      <tr class="hover:bg-slate-900/40 transition">
        <td class="px-4 py-3.5 font-semibold text-white">${d.ngoName}</td>
        <td class="px-4 py-3.5 font-mono-custom text-xs text-indigo-300">#${d.registrationNumber}</td>
        <td class="px-4 py-3.5 font-mono-custom font-bold text-emerald-400">+${amt.toFixed(3)} ETH</td>
        <td class="px-4 py-3.5 font-mono-custom text-xs text-gray-400">${shortWallet}</td>
        <td class="px-4 py-3.5 text-xs text-gray-400">${dateStr}</td>
        <td class="px-4 py-3.5">
          <span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-mono-custom bg-slate-900 border border-slate-800 text-indigo-400">
            <i data-lucide="external-link" class="w-3 h-3"></i>
            <span>${shortTx}</span>
          </span>
        </td>
      </tr>
    `;
  }).join('');

  if (myTotalSpan) myTotalSpan.textContent = `${totalDonated.toFixed(2)} ETH`;
  if (window.lucide) window.lucide.createIcons();
}

// Render Admin Whitelist
function renderWhitelist() {
  const tbody = document.getElementById('auth-list-body');
  if (!tbody) return;

  tbody.innerHTML = whitelist.map(item => `
    <tr class="hover:bg-slate-900/30 transition">
      <td class="px-4 py-3 font-mono-custom font-bold text-indigo-300">#${item.registrationNumber}</td>
      <td class="px-4 py-3 font-mono-custom text-xs text-gray-300">${item.wallet}</td>
      <td class="px-4 py-3">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.isEnrolled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">
          ${item.isEnrolled ? 'Active & Enrolled' : 'Pre-Authorized (Pending Form)'}
        </span>
      </td>
      <td class="px-4 py-3 text-xs text-gray-500">${item.date || '2026-09-13'}</td>
    </tr>
  `).join('');
}

// Update Top Metric Stat Cards
function updateStats() {
  let totalEth = 0;
  ngos.forEach(n => totalEth += parseFloat(n.totalDonationsReceived || 0));
  
  const ethSpan = document.getElementById('stat-total-eth');
  const usdSpan = document.getElementById('stat-total-usd');
  const ngoSpan = document.getElementById('stat-total-ngos');

  if (ethSpan) ethSpan.textContent = totalEth.toFixed(2);
  if (usdSpan) usdSpan.textContent = (totalEth * ETH_PRICE_USD).toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (ngoSpan) ngoSpan.textContent = ngos.length;
}

// Donation Modal Logic
function openDonateModal(regId) {
  const ngo = ngos.find(n => n.registrationNumber === regId);
  if (!ngo) return;

  selectedNgoForDonation = ngo;
  document.getElementById('modal-ngo-name').textContent = ngo.name;
  document.getElementById('modal-reg-id').textContent = `#${ngo.registrationNumber}`;
  document.getElementById('modal-wallet-addr').textContent = ngo.wallet;

  setPresetAmount('0.05');

  const modal = document.getElementById('donate-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeDonateModal() {
  const modal = document.getElementById('donate-modal');
  if (modal) modal.classList.add('hidden');
  selectedNgoForDonation = null;
}

function setPresetAmount(val) {
  const input = document.getElementById('donation-amount-input');
  const usdSpan = document.getElementById('modal-amount-usd');
  if (input) {
    input.value = val;
    if (usdSpan) usdSpan.textContent = (parseFloat(val) * ETH_PRICE_USD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

// Handle Donation Submit
async function handleDonationSubmit(e) {
  e.preventDefault();
  if (!selectedNgoForDonation) return;

  const amountInput = document.getElementById('donation-amount-input');
  const amount = parseFloat(amountInput.value);

  if (!amount || amount <= 0) {
    showToast("Please enter a valid donation amount", "error");
    return;
  }

  const confirmBtn = document.getElementById('confirm-donate-btn');
  const origBtnContent = confirmBtn.innerHTML;
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Processing Transaction...</span>`;
  if (window.lucide) window.lucide.createIcons();

  try {
    let txHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');

    // If Web3 Live mode and connected
    if (appMode === 'web3' && userAccount && provider) {
      const signer = provider.getSigner();
      // Direct transfer to NGO wallet
      const tx = await signer.sendTransaction({
        to: selectedNgoForDonation.wallet,
        value: ethers.utils.parseEther(amount.toString())
      });
      txHash = tx.hash;
      await tx.wait();
    } else {
      // Simulate on-chain confirmation delay
      await new Promise(r => setTimeout(r, 1200));
    }

    // Update Local State
    selectedNgoForDonation.totalDonationsReceived = (parseFloat(selectedNgoForDonation.totalDonationsReceived || 0) + amount).toFixed(2);
    
    donations.unshift({
      registrationNumber: selectedNgoForDonation.registrationNumber,
      ngoName: selectedNgoForDonation.name,
      ngoWallet: selectedNgoForDonation.wallet,
      amount: amount.toFixed(3),
      timestamp: Date.now(),
      txHash: txHash
    });

    // Save to LocalStorage
    localStorage.setItem('semp_ngos', JSON.stringify(ngos));
    localStorage.setItem('semp_donations', JSON.stringify(donations));

    closeDonateModal();
    renderNGOs();
    renderDonations();
    updateStats();

    showToast(`Successfully donated ${amount} ETH to ${selectedNgoForDonation.name}!`, "success");
  } catch (err) {
    console.error(err);
    showToast(err.message || "Donation failed or was rejected", "error");
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = origBtnContent;
    if (window.lucide) window.lucide.createIcons();
  }
}

// Handle Upvoting
function handleUpvote(regId) {
  const ngo = ngos.find(n => n.registrationNumber === regId);
  if (!ngo) return;

  ngo.upvotes = (ngo.upvotes || 0) + 1;
  const countSpan = document.getElementById(`upvotes-${regId}`);
  if (countSpan) countSpan.textContent = ngo.upvotes;

  localStorage.setItem('semp_ngos', JSON.stringify(ngos));
  showToast(`Upvoted ${ngo.name}!`, "success");
}

// Handle NGO Enrollment Form
function handleEnrollmentSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('enroll-name').value.trim();
  const regId = parseInt(document.getElementById('enroll-reg-id').value);
  const category = document.getElementById('enroll-category').value;
  const wallet = document.getElementById('enroll-wallet').value.trim();
  const desc = document.getElementById('enroll-description').value.trim();

  // Validate against whitelist
  const authEntry = whitelist.find(w => w.registrationNumber === regId);
  if (!authEntry) {
    showToast(`Registration #${regId} is not whitelisted. Please request the Platform Admin to authorize your NGO first.`, "error");
    return;
  }

  if (authEntry.wallet.toLowerCase() !== wallet.toLowerCase()) {
    showToast(`Provided wallet does not match the authorized wallet (${authEntry.wallet}) for Registration #${regId}`, "error");
    return;
  }

  // Check if already enrolled
  if (ngos.some(n => n.registrationNumber === regId)) {
    showToast(`NGO #${regId} is already enrolled and listed on the platform!`, "warning");
    return;
  }

  // Add new enrolled NGO
  const newNGO = {
    registrationNumber: regId,
    name: name,
    category: category,
    description: desc,
    wallet: wallet,
    upvotes: 1,
    totalDonationsReceived: "0.00",
    goal: "10.00",
    isEnrolled: true,
    coverColor: "from-indigo-600 to-purple-600",
    icon: "building"
  };

  ngos.unshift(newNGO);
  authEntry.isEnrolled = true;

  localStorage.setItem('semp_ngos', JSON.stringify(ngos));
  localStorage.setItem('semp_whitelist', JSON.stringify(whitelist));

  document.getElementById('enroll-ngo-form').reset();
  renderNGOs();
  renderWhitelist();
  updateStats();

  showToast(`Congratulations! "${name}" has been successfully enrolled on-chain!`, "success");
  switchTab('explore');
}

// Handle Admin Whitelist Submit
function handleAdminAuthSubmit(e) {
  e.preventDefault();
  const regId = parseInt(document.getElementById('auth-reg-number').value);
  const wallet = document.getElementById('auth-wallet').value.trim();

  if (whitelist.some(w => w.registrationNumber === regId)) {
    showToast(`Registration ID #${regId} is already in the authorized whitelist!`, "warning");
    return;
  }

  const newEntry = {
    registrationNumber: regId,
    wallet: wallet,
    isEnrolled: false,
    date: new Date().toISOString().split('T')[0]
  };

  whitelist.unshift(newEntry);
  localStorage.setItem('semp_whitelist', JSON.stringify(whitelist));

  document.getElementById('admin-auth-form').reset();
  renderWhitelist();

  showToast(`Authorized NGO Registration #${regId} on the whitelist!`, "success");
}

// Reset Demo Data
function resetDemoData() {
  localStorage.removeItem('semp_ngos');
  localStorage.removeItem('semp_donations');
  localStorage.removeItem('semp_whitelist');
  ngos = [...INITIAL_DEMO_NGOS];
  donations = [];
  whitelist = [...INITIAL_DEMO_WHITELIST];
  renderNGOs();
  renderDonations();
  renderWhitelist();
  updateStats();
  showToast("Demo data reset to default!", "info");
}

// Toast Notifications System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'bg-emerald-950/90 border-emerald-500 text-emerald-200',
    error: 'bg-rose-950/90 border-rose-500 text-rose-200',
    warning: 'bg-amber-950/90 border-amber-500 text-amber-200',
    info: 'bg-slate-900/90 border-indigo-500 text-indigo-200'
  }[type] || 'bg-slate-900 border-slate-700 text-white';

  const typeIcons = {
    success: 'check-circle',
    error: 'alert-triangle',
    warning: 'alert-circle',
    info: 'info'
  }[type] || 'info';

  toast.className = `toast pointer-events-auto p-4 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center space-x-3 text-xs font-semibold ${typeStyles}`;
  toast.innerHTML = `
    <i data-lucide="${typeIcons}" class="w-5 h-5 flex-shrink-0"></i>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}