<?php
// upload.php - обработчик загрузки файлов на PHP
header('Content-Type: application/json; charset=utf-8');

$teacherId = isset($_POST['teacherId']) ? intval($_POST['teacherId']) : 0;
if ($teacherId <= 0) {
    echo json_encode(['success' => false, 'error' => 'Invalid teacher ID']);
    exit;
}

$uploadDir = __DIR__ . '/uploads/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if (!isset($_FILES['file'])) {
    echo json_encode(['success' => false, 'error' => 'No file uploaded']);
    exit;
}

$file = $_FILES['file'];
$fileName = basename($file['name']);
// Очищаем имя от опасных символов
$fileName = preg_replace('/[^\p{L}\p{N}\.\-_]/u', '_', $fileName);
$targetPath = $uploadDir . $teacherId . '_' . time() . '_' . $fileName;

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    echo json_encode([
        'success' => true,
        'file' => [
            'name' => $fileName,
            'size' => round($file['size'] / (1024 * 1024), 2) . ' MB',
            'date' => date('d.m.Y'),
            'url' => 'uploads/' . basename($targetPath)
        ]
    ]);
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to move uploaded file']);
}
