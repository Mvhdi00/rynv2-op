CREATE TABLE IF NOT EXISTS hits (
    id      TEXT    NOT NULL,
    day     TEXT    NOT NULL,
    event   TEXT    NOT NULL,
    version TEXT    NOT NULL DEFAULT 'unknown',
    country TEXT    NOT NULL DEFAULT '??',
    ts      INTEGER NOT NULL,
    count   INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (id, day, event)
);

CREATE INDEX IF NOT EXISTS hits_day ON hits (day);
CREATE INDEX IF NOT EXISTS hits_ts  ON hits (ts);
