<?php require_once '../session.php'; if(!in_array($_SESSION['user']['rol'], ['administrador', 'administrativo'])) die('Acceso denegado'); ?>
<div class="admin-panel">
<h2>Gestión de Reservas Poli (Administrador)</h2>
    <div class="table-container">
        <table class="admin-table">
            <thead>
                <tr><th>Usuario</th><th>Espacio</th><th>Fecha</th><th>Horario</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody id="admin-list-body"></tbody>
        </table>
    </div>
</div>