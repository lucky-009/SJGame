/**
 * 游戏常量定义
 */

const GAME_PHASES = {
    DEALING: 'dealing',
    DEALEND: 'dealEnd',
    BOTTOMING: 'bottoming',
    PLAYING: 'playing',
    SETTLING: 'settling',
    FINISHED: 'finished'
};

const LEVEL_MAP = {
    2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7,
    8: 8, 9: 9, 10: 10, 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

const DRAW_PRIORITY = ['hearts5_pair', 'big_joker_pair', 'small_joker_pair', 'trump_pair'];

const PLAY_TYPE_ORDER = { trumpKill: 3, normal: 2, discard: 1 };

const SUIT_LABELS = {
    'spade': '♠',
    'heart': '♥',
    'club': '♣',
    'diamond': '♦'
};

const TRUMP_PRIORITY_ORDER = ['5', 'small', 'big'];

module.exports = {
    GAME_PHASES,
    LEVEL_MAP,
    DRAW_PRIORITY,
    PLAY_TYPE_ORDER,
    SUIT_LABELS,
    TRUMP_PRIORITY_ORDER
};
