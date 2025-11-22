<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query("SELECT * FROM services");
        echo json_encode($stmt->fetchAll());
        break;

    case 'POST':
        // Disable error display to prevent HTML output breaking JSON
        ini_set('display_errors', 0);

        // Handle File Upload
        $imageUrl = null;
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = '../uploads/services/';
            if (!is_dir($uploadDir)) {
                if (!@mkdir($uploadDir, 0777, true)) {
                    $error = error_get_last();
                    file_put_contents('debug.log', "Mkdir failed: " . print_r($error, true) . "\n", FILE_APPEND);
                    http_response_code(500);
                    echo json_encode(['error' => 'Failed to create upload directory']);
                    exit;
                }
            }
            
            $fileTmpPath = $_FILES['image']['tmp_name'];
            $fileName = $_FILES['image']['name'];
            $fileNameCmps = explode(".", $fileName);
            $fileExtension = strtolower(end($fileNameCmps));

            // Validate extension
            $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            if (!in_array($fileExtension, $allowedExtensions)) {
                file_put_contents('debug.log', "Invalid extension: $fileExtension\n", FILE_APPEND);
                http_response_code(400);
                echo json_encode(['error' => 'Invalid file type. Allowed: ' . implode(', ', $allowedExtensions)]);
                exit;
            }

            $newFileName = md5(time() . $fileName) . '.' . $fileExtension;
            $dest_path = $uploadDir . $newFileName;

            if(@move_uploaded_file($fileTmpPath, $dest_path)) {
                $imageUrl = '/uploads/services/' . $newFileName;
            } else {
                $error = error_get_last();
                file_put_contents('debug.log', "Move uploaded file failed: " . print_r($error, true) . "\nPath: $dest_path\nTmp: $fileTmpPath\n", FILE_APPEND);
                http_response_code(500);
                echo json_encode(['error' => 'Failed to move uploaded file']);
                exit;
            }
        }

        // Handle JSON or FormData
        $contentType = $_SERVER["CONTENT_TYPE"] ?? '';
        if (strpos($contentType, 'application/json') !== false) {
            $data = json_decode(file_get_contents('php://input'), true);
        } else {
            $data = $_POST;
        }

        // Determine if Create or Update based on ID
        if (isset($data['id']) && !empty($data['id'])) {
            // UPDATE
            $sql = "UPDATE services SET name = ?, description = ?";
            $params = [$data['name'], $data['description']];
            
            if ($imageUrl) {
                $sql .= ", image_url = ?";
                $params[] = $imageUrl;
            } elseif (isset($data['image_url']) && $data['image_url'] === '') {
                 // Handle case where image might be cleared? Or just ignore if not sent.
                 // For now, if no file sent, keep old image unless specific logic.
                 // If user sends empty string in image_url (from JSON), maybe clear it?
                 // Let's stick to: if file uploaded, update image.
            }

            $sql .= " WHERE id = ?";
            $params[] = $data['id'];

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            echo json_encode(['message' => 'Service updated']);

        } else {
            // INSERT
            $stmt = $pdo->prepare("INSERT INTO services (name, description, image_url) VALUES (?, ?, ?)");
            $stmt->execute([$data['name'], $data['description'], $imageUrl ?? ($data['image_url'] ?? null)]);
            echo json_encode(['id' => $pdo->lastInsertId(), 'message' => 'Service created']);
        }
        break;

    case 'PUT':
        // Keep for legacy JSON updates if needed, but POST is preferred for files
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $pdo->prepare("UPDATE services SET name = ?, description = ?, image_url = ? WHERE id = ?");
        $stmt->execute([$data['name'], $data['description'], $data['image_url'] ?? null, $data['id']]);
        echo json_encode(['message' => 'Service updated']);
        break;

    case 'DELETE':
        $id = $_GET['id'];
        $stmt = $pdo->prepare("DELETE FROM services WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['message' => 'Service deleted']);
        break;
}
?>
