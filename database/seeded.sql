USE gamenight;

INSERT INTO users (username, password, role) VALUES
 ('admin1', 'adminpass123', 'admin'),
 ('member1', 'memberpass123', 'member');


INSERT INTO games (title, genre, min_players, max_players, difficulty, status, archived) VALUES
('Catan', 'Strategy', 3, 4, 'medium', 'available', FALSE),
('Codenames', 'Party', 2, 8, 'easy', 'available', FALSE),
('Gloomhaven', 'Adventure', 1, 4, 'hard', 'available', FALSE),
('Monopoly (Missing Pieces)', 'Family', 2, 6, 'easy', 'available', TRUE);