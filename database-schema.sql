-- Athena Scouting Database Schema
-- This schema defines all tables for the Athena FRC scouting application

-- User accounts table (username-only authentication)
CREATE TABLE users (
    id NVARCHAR(255) PRIMARY KEY,
    name NVARCHAR(255),
    username NVARCHAR(255) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    role NVARCHAR(50) DEFAULT 'scout', -- 'admin', 'scout', 'coach'
    avatarUrl NVARCHAR(1024), -- API URL for the current avatar
    avatarData VARBINARY(MAX), -- Raw avatar image bytes
    avatarMimeType NVARCHAR(100), -- MIME type for avatarData
    push_subscriptions NVARCHAR(MAX), -- JSON array of push subscription endpoints
    preferredPartners NVARCHAR(MAX), -- JSON array of user IDs for scheduling preferences
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- Pit scouting entries table
CREATE TABLE pitEntries (
    id INT IDENTITY(1,1) PRIMARY KEY,
    teamNumber INT NOT NULL,
    year INT NOT NULL,
    competitionType NVARCHAR(10) DEFAULT 'FRC' NOT NULL,
    driveTrain NVARCHAR(50) NOT NULL, -- 'Swerve', 'Mecanum', 'Tank', 'Other'
    weight DECIMAL(10,2) NULL,
    length DECIMAL(10,2) NULL,
    width DECIMAL(10,2) NULL,
    eventName NVARCHAR(255),
    eventCode NVARCHAR(50),
    userId NVARCHAR(255), -- User who created this entry
    gameSpecificData NVARCHAR(MAX), -- JSON object with game-specific pit scouting data
    autoDrawing NVARCHAR(MAX), -- Base64 PNG data URL of autonomous path drawing
    notes NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_pit_entry UNIQUE (teamNumber, eventCode, year, competitionType)
);

-- Match scouting entries table
CREATE TABLE matchEntries (
    id INT IDENTITY(1,1) PRIMARY KEY,
    matchNumber INT NOT NULL,
    teamNumber INT NOT NULL,
    year INT NOT NULL,
    competitionType NVARCHAR(10) DEFAULT 'FRC' NOT NULL,
    alliance NVARCHAR(10) NOT NULL, -- 'red' or 'blue'
    alliancePosition INT, -- 1, 2, or 3 for alliance position (Red 1, Red 2, Red 3, etc.)
    eventName NVARCHAR(255),
    eventCode NVARCHAR(50),
    userId NVARCHAR(255), -- User who created this entry
    gameSpecificData NVARCHAR(MAX), -- JSON object with game-specific match data
    notes NVARCHAR(MAX),
    timestamp DATETIME2 NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_match_entry UNIQUE (teamNumber, matchNumber, eventCode, year, competitionType)
);

-- Custom events table for events not available on The Blue Alliance
CREATE TABLE customEvents (
    id INT IDENTITY(1,1) PRIMARY KEY,
    eventCode NVARCHAR(50) UNIQUE NOT NULL, -- Unique identifier (e.g., '2025-custom-001')
    name NVARCHAR(255) NOT NULL, -- Display name
    date DATE NOT NULL, -- Event start date
    endDate DATE, -- Optional end date for multi-day events
    matchCount INT NOT NULL DEFAULT 0, -- Number of matches in the event
    location NVARCHAR(255), -- Optional location/city
    region NVARCHAR(100), -- Optional region/state
    year INT NOT NULL, -- FRC year
    competitionType NVARCHAR(10) DEFAULT 'FRC' NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- Per-match scouting schedule assignments
CREATE TABLE matchAssignments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    eventCode NVARCHAR(50) NOT NULL,
    year INT NOT NULL,
    competitionType NVARCHAR(10) DEFAULT 'FRC' NOT NULL,
    matchNumber INT NOT NULL,
    alliance NVARCHAR(10) NOT NULL,
    position INT NOT NULL,
    userId NVARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ck_match_assignment_alliance CHECK (alliance IN ('red', 'blue')),
    CONSTRAINT ck_match_assignment_position CHECK (position BETWEEN 0 AND 2),
    CONSTRAINT uq_match_assignment UNIQUE
        (eventCode, year, competitionType, matchNumber, alliance, position)
);

-- Create indexes for performance
CREATE INDEX idx_pit_entries_competition ON pitEntries(competitionType, year);
CREATE INDEX idx_match_entries_competition ON matchEntries(competitionType, year);
CREATE INDEX idx_custom_events_competition ON customEvents(competitionType, year);
CREATE INDEX idx_match_assignments_event
    ON matchAssignments(eventCode, year, competitionType, matchNumber);

-- Picklists table for alliance selection
CREATE TABLE picklists (
    id INT IDENTITY(1,1) PRIMARY KEY,
    eventCode NVARCHAR(50) NOT NULL,
    year INT NOT NULL,
    competitionType NVARCHAR(10) DEFAULT 'FRC' NOT NULL,
    picklistType NVARCHAR(20) DEFAULT 'main' NOT NULL, -- 'main', 'pick1', 'pick2'
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT uq_picklist UNIQUE (eventCode, year, competitionType, picklistType)
);

-- Picklist entries for team rankings
CREATE TABLE picklistEntries (
    id INT IDENTITY(1,1) PRIMARY KEY,
    picklistId INT NOT NULL,
    teamNumber INT NOT NULL,
    rank INT NOT NULL, -- Position in the picklist (1 = highest priority)
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (picklistId) REFERENCES picklists(id) ON DELETE CASCADE,
    CONSTRAINT uq_picklist_team UNIQUE (picklistId, teamNumber)
);

-- Picklist notes for teams
CREATE TABLE picklistNotes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    picklistId INT NOT NULL,
    teamNumber INT NOT NULL,
    note NVARCHAR(MAX),
    userId NVARCHAR(255), -- User who created the note
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (picklistId) REFERENCES picklists(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for picklist tables
CREATE INDEX idx_picklist_event ON picklists(eventCode, year, competitionType);
CREATE INDEX idx_picklist_entries_picklist ON picklistEntries(picklistId);
CREATE INDEX idx_picklist_entries_rank ON picklistEntries(picklistId, rank);
CREATE INDEX idx_picklist_notes_picklist ON picklistNotes(picklistId, teamNumber);

