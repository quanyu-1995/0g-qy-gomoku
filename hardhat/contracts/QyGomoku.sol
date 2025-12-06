// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

// TODO 平局场景、setter、
// TODO 改用数组存储游戏 ID（如 uint256[] allGameIds;），并按状态分类存储（如 uint256[] activeGameIds;）
contract QyGomoku is Ownable {

    struct GomokuStorage {
        mapping(uint256 => Game) games;
        mapping(address => uint256) userGame;
        mapping(address => mapping(uint256 => bool)) userGameHistory;
        mapping(uint256 => mapping(uint8 => mapping(uint8 => uint8))) gameBoard;

        uint256 stakePool;
        uint256 lockedPool;
        uint16 feeRate;
        uint256 nextGameId;
        uint256 maxStake;
        uint256 minStake;
        uint32 intervalTime;
    }

    struct Game {
        address creator;
        address joiner;
        uint256 stake;
        bool started;
        bool finished;
        address currentTurn;
        address winner;
        uint32 lastMoveTime;
    }

    struct GameQueryResult {
        uint256[] gameIds;
        uint256 totalCount;
        uint256 totalPages;
    }

    event GameCreated(uint256 gameId, uint256 stake, address creator);
    event PlaceStone(uint256 indexed _gameId, address indexed player, uint8 x, uint8 y);
    event GameFinished(uint256 indexed _gameId, address winner);
    event SettleTimeout(uint256 indexed _gameId, address winner);


    // keccak256(abi.encode(uint(keccak256("0g.qy.gomoku")) - 1)) & ~bytes32(uint(0xff))
    bytes32 private constant GOMOKU_STORAGE_LOCATION = 0xba4cbdeb3e01470cb57d8a1628ddda7aeec60ecf61cf75f960a0d7c63a148600;

    function _getStorage() private pure returns (GomokuStorage storage $) {
        assembly {
            $.slot := GOMOKU_STORAGE_LOCATION
        }
    }

    constructor() 
        Ownable(msg.sender) 
    {
        GomokuStorage storage $ = _getStorage();
        $.nextGameId = 1;
        $.feeRate = 0;
        $.maxStake = 1e19;
        $.minStake = 1e14;
    }

    function stakePool() external view returns (uint256) {
        GomokuStorage storage $ = _getStorage();
        return $.stakePool;
    }

    function lockedPool() external view returns (uint256) {
        GomokuStorage storage $ = _getStorage();
        return $.lockedPool;
    }

    function depositPrizePool() external payable {
        require(msg.value > 0, "Must send 0g");
        GomokuStorage storage $ = _getStorage();
        $.stakePool += msg.value;
    }
    
    function withdrawPrizePool(uint amount) external onlyOwner{
        GomokuStorage storage $ = _getStorage();
        require(amount <= $.stakePool, "Amount too big");
        $.stakePool -= amount;
        payable(owner()).transfer(amount);
    }

    
    function trySettleTimeout(uint256 _gameId) external {
        GomokuStorage storage $ = _getStorage();
        Game storage game = $.games[_gameId];
        require(game.started && !game.finished, "Game not active");
        
        if (block.timestamp > game.lastMoveTime + $.intervalTime) {
            address winner = game.currentTurn == game.creator ? game.joiner : game.creator;
            _settleGame(game, _gameId, winner);
            emit SettleTimeout(_gameId, winner);
        } else {
            revert("Not timeout yet");
        }
    }

    function createGame(address agentAddress) external payable returns (uint256) {
        GomokuStorage storage $ = _getStorage();
        require(msg.value <= $.maxStake && msg.value >= $.minStake, "Invalid stake");
        require($.userGame[msg.sender] == 0, "Already in a game");
        require(msg.value <= $.stakePool, "Insufficient stake");
        
        // TODO agentAddress verification 

        $.lockedPool += msg.value * 2;
        $.stakePool -= msg.value;
        
        $.games[$.nextGameId] = Game({
            creator: msg.sender, 
            joiner: agentAddress, 
            stake: msg.value, 
            started: true, 
            finished: false, 
            currentTurn: msg.sender, 
            winner: address(0),
            lastMoveTime: uint32(block.timestamp)
        });
        
        $.userGame[msg.sender] = $.nextGameId;
        $.userGameHistory[msg.sender][$.nextGameId] = false;
        $.nextGameId++;
        emit GameCreated($.nextGameId - 1, msg.value, msg.sender);
        return $.nextGameId - 1;
    }

    // mode: 0 = joinable games, 1 = my history (settled games involving msg.sender), 2 = all games
    function getGames(uint256 page, uint256 pageSize, uint8 mode) external view returns (GameQueryResult memory) {
        require(pageSize > 0 && page > 0, "Invalid page params");

        uint256[] memory result = new uint256[](pageSize);
        uint256 count = 0;
        uint256 skip = (page - 1) * pageSize;
        uint256 processed = 0;
        uint256 totalCount = 0;

        GomokuStorage storage $ = _getStorage();
        if (mode == 1) {
            // my history (settled games involving caller)
            for (uint256 i = 1; i < $.nextGameId; i++) {
                if ($.userGameHistory[msg.sender][i]) {
                    totalCount++;
                    if (processed >= skip && count < pageSize) {
                        result[count++] = i;
                    }
                    processed++;
                }
            }
            if ($.userGame[msg.sender] != 0) {
                totalCount++;
                if (processed >= skip && count < pageSize) {
                    result[count++] = $.userGame[msg.sender];
                }
                processed++;
            }
        } else {
            // all games (iterate by id)
            for (uint256 i = 1; i < $.nextGameId; i++) {
                Game storage game = $.games[i];
                if (game.creator != address(0)) {
                    totalCount++;
                    if (processed >= skip && count < pageSize) {
                        result[count++] = i;
                    }
                    processed++;
                }
            }
        }

        uint256[] memory truncated = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            truncated[i] = result[i];
        }

        uint256 totalPages = (totalCount + pageSize - 1) / pageSize;
        return GameQueryResult(truncated, totalCount, totalPages);
    }

    function placeStone(uint256 _gameId, uint8 x, uint8 y) external {
        GomokuStorage storage $ = _getStorage();
        Game storage game = $.games[_gameId];
        require(game.started && !game.finished, "Game not active");
        require(msg.sender == game.currentTurn, "Not your turn");

        if (block.timestamp > game.lastMoveTime + $.intervalTime) {
            address winner = msg.sender == game.creator ? game.joiner : game.creator;
            _settleGame(game, _gameId, winner);
            emit SettleTimeout(_gameId, winner);
            return;
        }

        require(x < 15 && y < 15, "Out of bounds");
        require($.gameBoard[_gameId][x][y] == 0, "Already occupied");

        uint8 playerMark = msg.sender == game.creator ? 1 : 2;
        $.gameBoard[_gameId][x][y] = playerMark;
        game.lastMoveTime = uint32(block.timestamp);
        emit PlaceStone(_gameId, msg.sender, x, y);
        if (checkWin(_gameId, x, y, playerMark)) {
            _settleGame(game, _gameId, msg.sender);
            emit GameFinished(_gameId, msg.sender);
        } else {
            game.currentTurn = msg.sender == game.creator ? game.joiner : game.creator;
        }
    }


    function getMyGame() external view returns (uint256){
        GomokuStorage storage $ = _getStorage();
        return $.userGame[msg.sender];
    }

    function getGame(uint256 gameId) external view returns (
        address, address, uint256, bool, bool, address, address, uint32
    ) {
        GomokuStorage storage $ = _getStorage();
        Game storage game = $.games[gameId];
        return (
            game.creator, game.joiner, game.stake, 
            game.started, game.finished, game.currentTurn, 
            game.winner, game.lastMoveTime
        );
    }

    function getBoardCell(uint256 gameId, uint8 x, uint8 y) external view returns (uint8) {
        require(x < 15 && y < 15, "Out of bounds");
        GomokuStorage storage $ = _getStorage();
        return $.gameBoard[gameId][x][y];
    }

    function getBoard(uint256 gameId) external view returns (uint8[][] memory) {
        GomokuStorage storage $ = _getStorage();
        uint8[][] memory board = new uint8[][](15);
        for (uint8 i = 0; i < 15; i++) {
            board[i] = new uint8[](15);
            for (uint8 j = 0; j < 15; j++) {
                board[i][j] = $.gameBoard[gameId][i][j];
            }
        }
        return board;
    }

    function checkWin(uint256 gameId, uint8 x, uint8 y, uint8 playerMark) internal view returns (bool) {
        int256[4][2] memory dirs = [
            [int256(1), int256(0), int256(1), int256(1)], // dx
            [int256(0), int256(1), int256(1), int256(-1)] // dy
        ];
        
        int256 nx = int256(uint256(x)); 
        int256 ny = int256(uint256(y));
        
        uint8 count;
        int256 stepInt;
        int256 newX;
        int256 newY;
        uint8 newXUint;
        uint8 newYUint;

        GomokuStorage storage $ = _getStorage();
        for (uint8 dir = 0; dir < 4; dir++) {
            count = 1; 
            
            for (uint8 step = 1; step < 5; step++) {
                assembly { stepInt := step }
                newX = nx + dirs[0][dir] * stepInt;
                newY = ny + dirs[1][dir] * stepInt;
                
                if (newX < 0 || newX >= 15 || newY < 0 || newY >= 15) break;

                assembly { newXUint := newX } 
                assembly { newYUint := newY }
                if ($.gameBoard[gameId][newXUint][newYUint] == playerMark) {
                    count++;
                } else {
                    break;
                }
            }
            
            for (uint8 step = 1; step < 5; step++) {
                assembly { stepInt := step }
                newX = nx - dirs[0][dir] * stepInt;
                newY = ny - dirs[1][dir] * stepInt;
                
                if (newX < 0 || newX >= 15 || newY < 0 || newY >= 15) break;

                assembly { newXUint := newX }
                assembly { newYUint := newY }
                if ($.gameBoard[gameId][newXUint][newYUint] == playerMark) {
                    count++;
                } else {
                    break;
                }
            }
            
            if (count >= 5) return true;
        }
        
        return false;
    }

    function _settleGame(Game storage game, uint256 gameId, address winner) internal {
        GomokuStorage storage $ = _getStorage();
        game.finished = true;
        game.winner = winner;
        
        uint256 total = uint256(game.stake) * 2;
        uint256 fee = total * uint256($.feeRate) / 10000;
        uint256 reward = total - fee;
        $.lockedPool -= total;
        if(winner==game.creator){
            payable(winner).transfer(reward);
        }else{
            $.stakePool += reward;
        }
        payable(owner()).transfer(fee);

        delete $.userGame[game.creator];
        delete $.userGame[game.joiner];
        $.userGameHistory[game.creator][gameId] = true;
        $.userGameHistory[game.joiner][gameId] = true;
    }
}