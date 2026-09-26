-- Enums
CREATE TYPE user_role AS ENUM ('passenger', 'driver');
CREATE TYPE pool_status AS ENUM ('OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE ride_status AS ENUM ('REQUESTED', 'MATCHED', 'ACCEPTED', 'ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role user_role NOT NULL
);

-- Vehicles Table
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    driver_id INT UNIQUE REFERENCES users(id),
    name VARCHAR(50) NOT NULL,
    capacity INT DEFAULT 3,
    is_online BOOLEAN DEFAULT true
);

-- Pools Table
CREATE TABLE pools (
    id SERIAL PRIMARY KEY,
    driver_id INT REFERENCES users(id),
    available_seats INT DEFAULT 3,
    status pool_status DEFAULT 'OPEN'
);

-- Ride Requests Table
CREATE TABLE ride_requests (
    id SERIAL PRIMARY KEY,
    passenger_id INT REFERENCES users(id),
    pool_id INT REFERENCES pools(id),
    pickup_location VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    fare_poysha INT NOT NULL,
    status ride_status DEFAULT 'REQUESTED'
);

-- Seed Data (As per PRD Story)
INSERT INTO users (id, name, role) VALUES 
(1, 'Jashim', 'driver'),
(2, 'Nusrat', 'passenger'),
(3, 'Rafiq', 'passenger'),
(4, 'Shirin', 'passenger');

INSERT INTO vehicles (driver_id, name, capacity) VALUES 
(1, 'Bullet', 3);

INSERT INTO pools (id, driver_id, available_seats, status) VALUES 
(1, 1, 3, 'OPEN');