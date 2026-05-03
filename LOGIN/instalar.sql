USE usuarios;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rol ENUM('administrativo', 'docente', 'externo') NOT NULL DEFAULT 'externo',
    failed_attempts INT DEFAULT 0,
    locked_until DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    espacio ENUM('B1','B2','B3') NOT NULL,
    requisitos TEXT NULL,
    estado ENUM('Pendiente','Aprobada','Rechazada','Cancelada') DEFAULT 'Pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservas_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_rango_horario
        CHECK (hora_inicio < hora_fin)
);

CREATE INDEX idx_reservas_fecha_espacio ON reservas (fecha, espacio);
CREATE INDEX idx_reservas_usuario_id ON reservas (usuario_id);

DROP TRIGGER IF EXISTS reservas_validar_horario_insert;
DELIMITER $$
CREATE TRIGGER reservas_validar_horario_insert
BEFORE INSERT ON reservas
FOR EACH ROW
BEGIN
    IF NEW.hora_inicio >= NEW.hora_fin THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La hora_inicio debe ser menor que hora_fin';
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS reservas_validar_horario_update;
DELIMITER $$
CREATE TRIGGER reservas_validar_horario_update
BEFORE UPDATE ON reservas
FOR EACH ROW
BEGIN
    IF NEW.hora_inicio >= NEW.hora_fin THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La hora_inicio debe ser menor que hora_fin';
    END IF;
END$$
DELIMITER ;
