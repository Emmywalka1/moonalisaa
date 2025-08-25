class MOONALISAGame {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = null; // 'cow' or 'grass'
        this.playerSide = null; // What the human player chose
        this.computerSide = null;
        this.gameActive = false;
        this.isPlayerTurn = true;
        this.gameStats = this.loadStats();
        this.leaderboard = this.loadLeaderboard();
        this.playerName = '';
        
        // Farcaster miniapp integration
        this.sdk = null;
        this.farcasterUser = null;
        this.isInMiniapp = false;
        
        this.init();
    }

    async init() {
        // Initialize Farcaster SDK first and ensure ready() is called
        await this.initializeFarcaster();
        
        this.setupEventListeners();
        this.updateStatsDisplay();
        this.updateLeaderboard();
        this.updateResetTimer();
        this.showStatus('Choose your side to start playing! (Hard Mode Only)', 'info');
        
        // Check and reset leaderboard if needed
        this.checkWeeklyReset();
        
        // Update reset timer every minute
        setInterval(() => this.updateResetTimer(), 60000);
    }

    async initializeFarcaster() {
        // Need to call ready() before anything else
        await window.sdk.actions.ready()
        let sdkReady = false;
        
        try {            
            this.sdk = window.sdk;
            this.isInMiniapp = true;
            console.log('Farcaster SDK loaded successfully');

            // CRITICAL: Call ready() as soon as possible
            await this.sdk.actions.ready();
            sdkReady = true;
            console.log('✅ sdk.actions.ready() called successfully');

            // Now try to get user context (this can fail without breaking ready())
            try {
                const context = await this.sdk.context;
                if (context?.user) {
                    this.farcasterUser = context.user;
                    this.updateWalletStatus(context.user.custody_address);
                    
                    // Auto-fill player name if available
                    if (context.user.username && !this.playerName) {
                        const nameInput = document.getElementById('playerNameInput');
                        if (nameInput) {
                            nameInput.value = context.user.username;
                            this.playerName = context.user.username;
                        }
                    }
                    console.log('User context loaded:', context.user.username);
                }
            } catch (contextError) {
                console.log('Could not load user context (non-critical):', contextError);
            }
            
        } catch (error) {
            console.log('Farcaster SDK not available, running in fallback mode:', error);
            this.isInMiniapp = false;
            this.sdk = null;
            
            // If we're in a Farcaster environment but SDK failed, still try to call ready
            if (window.location !== window.parent.location) {
                console.log('Detected iframe environment, attempting fallback ready call');
                try {
                    // Fallback: try to call ready on window.parent if available
                    if (window.parent?.postMessage) {
                        window.parent.postMessage({ type: 'fc_ready' }, '*');
                        console.log('Fallback ready signal sent');
                    }
                } catch (fallbackError) {
                    console.log('Fallback ready call failed:', fallbackError);
                }
            }
        }
        
        // Ensure we always log the ready status
        if (sdkReady) {
            console.log('✅ Farcaster miniapp ready() called successfully');
        } else {
            console.log('⚠️ Could not call Farcaster ready() - app may show splash screen');
        }
    }

    updateWalletStatus(address) {
        const walletStatus = document.getElementById('walletStatus');
        const walletAddress = walletStatus.querySelector('.wallet-address');
        
        if (address) {
            const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
            walletAddress.textContent = `Wallet: ${shortAddress}`;
            walletStatus.classList.remove('hidden');
        }
    }

    async handleTokenPurchase(buttonId) {
        // If not in Farcaster miniapp, open external link
        if (!this.isInMiniapp || !this.sdk) {
            window.open('https://farcaster.xyz/emmywalka/0xe7e4e523', '_blank');
            return;
        }

        const statusElement = document.getElementById('transactionStatus');
        const statusText = statusElement.querySelector('.status-text');

        try {
            // Show pending status
            statusElement.classList.remove('hidden', 'success', 'error');
            statusElement.classList.add('pending');
            statusText.textContent = '⏳ Preparing transaction...';

            // Use the miniapp SDK to handle wallet operations
            const result = await this.sdk.actions.openUrl('https://farcaster.xyz/emmywalka/0xe7e4e523');
            
            if (result) {
                // Success - user was redirected to purchase
                statusElement.classList.remove('pending');
                statusElement.classList.add('success');
                statusText.textContent = '✅ Redirected to purchase!';
                
                // Hide after 3 seconds
                setTimeout(() => {
                    statusElement.classList.add('hidden');
                }, 3000);
            }
        } catch (error) {
            // Error
            statusElement.classList.remove('pending');
            statusElement.classList.add('error');
            statusText.textContent = '❌ Failed to open purchase link. Please try again.';
            
            console.error('Token purchase error:', error);
            
            // Hide after 5 seconds
            setTimeout(() => {
                statusElement.classList.add('hidden');
            }, 5000);
        }
    }

    async shareGameResult(result) {
        if (!this.isInMiniapp || !this.sdk) {
            // Fallback for non-miniapp environment
            this.copyShareText(result);
            return;
        }

        try {
            const shareText = this.generateShareText(result);
            const shareUrl = window.location.href;
            
            // Use miniapp SDK to share
            await this.sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(shareUrl)}`);
        } catch (error) {
            console.error('Share error:', error);
            this.copyShareText(result);
        }
    }

    generateShareText(result) {
        const playerIcon = this.playerSide === 'cow' ? '🐄' : '🌱';
        const opponentIcon = this.computerSide === 'cow' ? '🐄' : '🌱';
        
        if (result.type === 'win' && result.winner === this.playerSide) {
            return `🔥 Just CRUSHED the AI in MOONALISA Hard Mode! ${playerIcon} victory! Think you can beat the perfect AI? Try it yourself! 💪`;
        } else if (result.type === 'draw') {
            return `⚔️ Epic battle! Managed a DRAW against perfect AI in MOONALISA Hard Mode! ${playerIcon} vs ${opponentIcon} - Can you do better? 🤖`;
        } else {
            return `🤖 The AI got me this time in MOONALISA Hard Mode! ${opponentIcon} wins vs ${playerIcon} - Think you can beat the perfect AI? Challenge accepted! 💪`;
        }
    }

    copyShareText(result) {
        const text = this.generateShareText(result);
        navigator.clipboard.writeText(text).then(() => {
            this.showStatus('Share text copied to clipboard! 📋', 'success');
        }).catch(() => {
            this.showStatus('Share text: ' + text, 'info');
        });
    }

    setupEventListeners() {
        // Player selection
        document.getElementById('chooseCow').addEventListener('click', () => this.selectPlayer('cow'));
        document.getElementById('chooseGrass').addEventListener('click', () => this.selectPlayer('grass'));
        
        // Player name input
        document.getElementById('playerNameInput').addEventListener('input', (e) => {
            this.playerName = e.target.value.trim();
        });
        
        // Game controls
        document.getElementById('newGame').addEventListener('click', () => this.startNewGame());
        document.getElementById('backToSetup').addEventListener('click', () => this.backToSetup());
        document.getElementById('hintBtn').addEventListener('click', () => this.showHint());
        document.getElementById('playAgain').addEventListener('click', () => {
            // Hide the result modal first
            document.getElementById('gameResult').classList.add('hidden');
            // Then start a new game
            this.startNewGame();
        });
        
        // Token purchase buttons
        document.getElementById('buyTokenHeader').addEventListener('click', () => this.handleTokenPurchase('header'));
        document.getElementById('buyTokenMain').addEventListener('click', () => this.handleTokenPurchase('main'));
        document.getElementById('buyTokenResult').addEventListener('click', () => this.handleTokenPurchase('result'));
        
        // Share button (add this to your HTML if not present)
        const shareBtn = document.getElementById('shareResult');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                const result = this.getLastGameResult();
                if (result) this.shareGameResult(result);
            });
        }
        
        // Board clicks
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.makePlayerMove(parseInt(e.target.dataset.position)));
        });
        
        // Prevent context menu on mobile
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    selectPlayer(side) {
        this.playerSide = side;
        this.computerSide = side === 'cow' ? 'grass' : 'cow';
        
        // Update UI
        document.querySelectorAll('.player-btn').forEach(btn => btn.classList.remove('selected'));
        document.getElementById(side === 'cow' ? 'chooseCow' : 'chooseGrass').classList.add('selected');
        
        // Update player info
        if (side === 'cow') {
            document.getElementById('playerAvatar').textContent = '🐄';
            document.getElementById('playerType').textContent = 'Cow Player';
            document.getElementById('computerAvatar').textContent = '🌱';
            document.getElementById('computerType').textContent = 'Grass Player';
        } else {
            document.getElementById('playerAvatar').textContent = '🌱';
            document.getElementById('playerType').textContent = 'Grass Player';
            document.getElementById('computerAvatar').textContent = '🐄';
            document.getElementById('computerType').textContent = 'Cow Player';
        }
        
        this.startNewGame();
    }

    startNewGame() {
        if (!this.playerSide) {
            this.showStatus('Please choose your side first!', 'warning');
            return;
        }
        
        // Reset game state
        this.board = Array(9).fill(null);
        this.gameActive = true;
        this.currentPlayer = 'cow'; // Cow always goes first
        this.isPlayerTurn = this.playerSide === 'cow';
        
        // Clear board
        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.className = 'cell';
        });
        
        // Show game board
        document.querySelector('.game-setup').style.display = 'none';
        document.getElementById('gameBoard').classList.remove('hidden');
        
        // Update turn indicator
        this.updateTurnIndicator();
        
        // Clear any hints
        this.clearHints();
        
        if (!this.isPlayerTurn) {
            // Computer goes first
            setTimeout(() => this.makeComputerMove(), 800);
        }
        
        this.showStatus('Game started! Prepare for maximum difficulty.', 'success');
    }

    makePlayerMove(position) {
        if (!this.gameActive || !this.isPlayerTurn || this.board[position] !== null) {
            return;
        }

        // Clear any hints
        this.clearHints();
        
        // Make the move
        this.board[position] = this.playerSide;
        this.updateCellDisplay(position, this.playerSide);
        
        // Check for game end
        const result = this.checkGameEnd();
        if (result) {
            this.endGame(result);
            return;
        }
        
        // Switch turns
        this.isPlayerTurn = false;
        this.currentPlayer = this.computerSide;
        this.updateTurnIndicator();
        
        // Computer's turn
        setTimeout(() => this.makeComputerMove(), 600);
    }

    makeComputerMove() {
        if (!this.gameActive || this.isPlayerTurn) {
            return;
        }
        
        // Always use minimax (hard mode)
        const position = this.minimax(this.board, this.computerSide).position;
        
        // Make the move
        this.board[position] = this.computerSide;
        this.updateCellDisplay(position, this.computerSide);
        
        // Check for game end
        const result = this.checkGameEnd();
        if (result) {
            this.endGame(result);
            return;
        }
        
        // Switch turns
        this.isPlayerTurn = true;
        this.currentPlayer = this.playerSide;
        this.updateTurnIndicator();
    }

    minimax(board, player) {
        const availableMoves = board.map((cell, index) => cell === null ? index : null)
                                   .filter(val => val !== null);
        
        const winner = this.checkWinnerOnBoard(board);
        if (winner === this.computerSide) return { score: 10 };
        if (winner === this.playerSide) return { score: -10 };
        if (availableMoves.length === 0) return { score: 0 };
        
        const moves = [];
        
        for (let move of availableMoves) {
            const newBoard = [...board];
            newBoard[move] = player;
            
            const result = this.minimax(newBoard, player === this.computerSide ? this.playerSide : this.computerSide);
            moves.push({
                position: move,
                score: result.score
            });
        }
        
        if (player === this.computerSide) {
            return moves.reduce((best, move) => move.score > best.score ? move : best);
        } else {
            return moves.reduce((best, move) => move.score < best.score ? move : best);
        }
    }

    showHint() {
        if (!this.gameActive || !this.isPlayerTurn) {
            this.showStatus('Hints are only available during your turn!', 'warning');
            return;
        }
        
        this.clearHints();
        
        // Get best move for player using minimax
        const bestMove = this.minimax(this.board, this.playerSide).position;
        
        // Highlight the suggested move
        const cell = document.querySelector(`[data-position="${bestMove}"]`);
        cell.classList.add('hint');
        
        this.showStatus('💡 Best move highlighted in blue! (You\'ll need it on Hard Mode!)', 'info');
        
        // Remove hint after 3 seconds
        setTimeout(() => this.clearHints(), 3000);
    }

    clearHints() {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('hint');
        });
    }

    updateCellDisplay(position, player) {
        const cell = document.querySelector(`[data-position="${position}"]`);
        cell.textContent = player === 'cow' ? '🐄' : '🌱';
        cell.classList.add(player);
        cell.classList.add('disabled');
    }

    updateTurnIndicator() {
        const indicator = document.getElementById('turnIndicator');
        
        if (!this.gameActive) {
            indicator.textContent = 'Game Over';
            return;
        }
        
        if (this.isPlayerTurn) {
            const playerIcon = this.playerSide === 'cow' ? '🐄' : '🌱';
            indicator.textContent = `${playerIcon} Your Turn`;
        } else {
            const computerIcon = this.computerSide === 'cow' ? '🐄' : '🌱';
            indicator.textContent = `${computerIcon} AI Calculating...`;
        }
    }

    checkGameEnd() {
        const winner = this.checkWinner();
        if (winner) {
            return { type: 'win', winner };
        }
        
        if (this.board.every(cell => cell !== null)) {
            return { type: 'draw' };
        }
        
        return null;
    }

    checkWinner() {
        return this.checkWinnerOnBoard(this.board);
    }

    checkWinnerOnBoard(board) {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6] // Diagonals
        ];
        
        for (let line of lines) {
            const [a, b, c] = line;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a];
            }
        }
        
        return null;
    }

    endGame(result) {
        this.gameActive = false;
        this.lastGameResult = result; // Store for sharing
        this.updateTurnIndicator();
        
        // Highlight winning line
        this.highlightWinningLine();
        
        // Update stats
        this.updateStats(result);
        
        // Update leaderboard with points
        this.updateLeaderboardWithResult(result);
        
        // Show result modal
        setTimeout(() => this.showGameResult(result), 800);
    }

    getLastGameResult() {
        return this.lastGameResult;
    }

    highlightWinningLine() {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6] // Diagonals
        ];
        
        for (let line of lines) {
            const [a, b, c] = line;
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                line.forEach(pos => {
                    document.querySelector(`[data-position="${pos}"]`).classList.add('winning');
                });
                break;
            }
        }
    }

    showGameResult(result) {
        const modal = document.getElementById('gameResult');
        const icon = document.getElementById('resultIcon');
        const text = document.getElementById('resultText');
        const message = document.getElementById('resultMessage');
        const score = document.getElementById('resultScore');
        const tokenPromo = document.querySelector('.token-promo');
        
        let points = 0;
        
        if (result.type === 'win') {
            if (result.winner === this.playerSide) {
                icon.textContent = '👑';
                text.textContent = 'INCREDIBLE!';
                message.textContent = `You beat the AI on HARD MODE! ${this.playerSide === 'cow' ? 'Cows' : 'Grass'} reign supreme!`;
                points = 15; // More points for hard mode wins
                score.textContent = '+15 points!';
                tokenPromo.style.display = 'block';
            } else {
                icon.textContent = '🤖';
                text.textContent = 'AI Wins!';
                message.textContent = `The AI proves its superiority! ${this.computerSide === 'cow' ? 'Cows' : 'Grass'} dominate!`;
                points = 0;
                score.textContent = 'No points';
                tokenPromo.style.display = 'none';
            }
        } else {
            icon.textContent = '⚔️';
            text.textContent = "Epic Draw!";
            message.textContent = 'You held your ground against perfect AI! Legendary battle!';
            points = 8; // More points for draws against hard AI
            score.textContent = '+8 points!';
            tokenPromo.style.display = 'block';
        }
        
        modal.classList.remove('hidden');
    }

    updateStats(result) {
        if (result.type === 'win') {
            if (result.winner === 'cow') {
                this.gameStats.cowWins++;
            } else {
                this.gameStats.grassWins++;
            }
        } else {
            this.gameStats.draws++;
        }
        
        this.gameStats.totalGames++;
        this.saveStats();
        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        document.getElementById('cowWins').textContent = this.gameStats.cowWins;
        document.getElementById('grassWins').textContent = this.gameStats.grassWins;
        document.getElementById('draws').textContent = this.gameStats.draws;
        document.getElementById('totalGames').textContent = this.gameStats.totalGames;
    }

    // Leaderboard functions
    loadLeaderboard() {
        const saved = localStorage.getItem('moonalisa-leaderboard');
        if (saved) {
            const data = JSON.parse(saved);
            // Check if data is from current week
            if (this.isCurrentWeek(data.lastReset)) {
                return data;
            }
        }
        // Return new leaderboard structure
        return {
            players: {},
            lastReset: new Date().toISOString()
        };
    }

    saveLeaderboard() {
        localStorage.setItem('moonalisa-leaderboard', JSON.stringify(this.leaderboard));
    }

    isCurrentWeek(dateString) {
        if (!dateString) return false;
        
        const lastReset = new Date(dateString);
        const now = new Date();
        const daysSinceReset = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
        
        return daysSinceReset < 7;
    }

    checkWeeklyReset() {
        if (!this.isCurrentWeek(this.leaderboard.lastReset)) {
            // Reset leaderboard
            this.leaderboard = {
                players: {},
                lastReset: new Date().toISOString()
            };
            this.saveLeaderboard();
            this.updateLeaderboard();
        }
    }

    updateLeaderboardWithResult(result) {
        // Get player name - prefer Farcaster username
        let name = this.playerName;
        
        // If in Farcaster and no custom name entered, use Farcaster username
        if (!name && this.farcasterUser && this.farcasterUser.username) {
            name = this.farcasterUser.username;
        }
        
        // Fallback to Anonymous if no name
        name = name || 'Anonymous';
        
        // Calculate points (higher for hard mode)
        let points = 0;
        if (result.type === 'win' && result.winner === this.playerSide) {
            points = 15; // More points for beating hard AI
        } else if (result.type === 'draw') {
            points = 8; // More points for drawing against hard AI
        }
        
        // Update leaderboard
        if (!this.leaderboard.players[name]) {
            this.leaderboard.players[name] = 0;
        }
        this.leaderboard.players[name] += points;
        
        // Save and update display
        this.saveLeaderboard();
        this.updateLeaderboard();
    }

    updateLeaderboard() {
        const leaderboardList = document.getElementById('leaderboardList');
        
        // Convert to array and sort by score
        const sortedPlayers = Object.entries(this.leaderboard.players)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); // Top 10 players
        
        if (sortedPlayers.length === 0) {
            leaderboardList.innerHTML = '<div class="leaderboard-empty">No scores yet this week!</div>';
            return;
        }
        
        leaderboardList.innerHTML = sortedPlayers.map((player, index) => {
            const [name, score] = player;
            let rankClass = '';
            let rankEmoji = '';
            
            if (index === 0) {
                rankClass = 'gold';
                rankEmoji = '🥇';
            } else if (index === 1) {
                rankClass = 'silver';
                rankEmoji = '🥈';
            } else if (index === 2) {
                rankClass = 'bronze';
                rankEmoji = '🥉';
            } else {
                rankEmoji = `${index + 1}.`;
            }
            
            return `
                <div class="leaderboard-item ${rankClass}">
                    <span class="leaderboard-rank">${rankEmoji}</span>
                    <span class="leaderboard-name">${this.escapeHtml(name)}</span>
                    <span class="leaderboard-score">${score} pts</span>
                </div>
            `;
        }).join('');
    }

    updateResetTimer() {
        const timerElement = document.getElementById('resetTimer');
        const lastReset = new Date(this.leaderboard.lastReset);
        const nextReset = new Date(lastReset);
        nextReset.setDate(nextReset.getDate() + 7);
        
        const now = new Date();
        const timeLeft = nextReset - now;
        
        if (timeLeft <= 0) {
            this.checkWeeklyReset();
            return;
        }
        
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) {
            timerElement.textContent = `Resets in: ${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
        } else {
            timerElement.textContent = `Resets in: ${hours} hour${hours > 1 ? 's' : ''}`;
        }
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    loadStats() {
        const saved = localStorage.getItem('moonalisa-stats');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            cowWins: 0,
            grassWins: 0,
            draws: 0,
            totalGames: 0
        };
    }

    saveStats() {
        localStorage.setItem('moonalisa-stats', JSON.stringify(this.gameStats));
    }

    backToSetup() {
        document.querySelector('.game-setup').style.display = 'block';
        document.getElementById('gameBoard').classList.add('hidden');
        document.getElementById('gameResult').classList.add('hidden');
        
        this.gameActive = false;
        this.showStatus('Choose your side for an epic Hard Mode battle!', 'info');
    }

    showStatus(message, type = 'info') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        
        if (type !== 'warning') {
            setTimeout(() => {
                status.textContent = '';
                status.className = 'status';
            }, 4000);
        }
    }
}

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new MOONALISAGame();
});
