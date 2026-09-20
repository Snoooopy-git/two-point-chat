const db = require('../db');

function areFriends(userId, friendId) {
  return Boolean(db.prepare(
    'SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?'
  ).get(userId, friendId));
}

function insertFriendshipPair(firstUserId, secondUserId) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)'
  );
  insert.run(firstUserId, secondUserId);
  insert.run(secondUserId, firstUserId);
}

module.exports = { areFriends, insertFriendshipPair };
