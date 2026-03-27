# Guía de Despliegue en Dokploy

## Problema Solucionado

El error `Failed to execute 'json' on 'Response': Unexpected end of JSON input` ocurría porque:
1. El schema de base de datos faltaba la columna `created_at` en la tabla `subscriptions`
2. Los errores fatales de PHP devolvían HTML en lugar de JSON
3. El frontend no manejaba adecuadamente respuestas no-JSON

## Pasos para Desplegar en Dokploy

### 1. Configurar Variables de Entorno en Dokploy

En el panel de Dokploy, configura estas variables de entorno para el servicio:

```
MYSQL_ROOT_PASSWORD=tu_password_seguro_aqui
MYSQL_DATABASE=payments_db
MYSQL_USER=payments_user
MYSQL_PASSWORD=tu_password_seguro_aqui
JWT_SECRET=tu_jwt_secret_aqui_genera_uno_seguro
ENVIRONMENT=production
ALLOWED_ORIGINS=https://tu-dominio.dokploy.app
```

**Para generar JWT_SECRET seguro:**
```bash
openssl rand -base64 32
```

### 2. Verificar Estructura del Proyecto

Asegúrate de que el repositorio contenga:
- `docker-compose.prod.yml` - Configuración de producción
- `Dockerfile.frontend` - Build del frontend
- `Dockerfile.backend` - Configuración PHP/Apache
- `database/schema.sql` - Schema actualizado con columna `created_at`

### 3. Configurar Docker Compose en Dokploy

Usa el archivo `docker-compose.prod.yml` para el despliegue.

### 4. Verificar Conexión a Base de Datos

Una vez desplegado, verifica que las tablas se crearon correctamente:

```bash
# Entra al contenedor de la base de datos
docker exec -it payments_db_prod mysql -u payments_user -p

# Verifica las tablas
USE payments_db;
SHOW TABLES;

# Verifica que la tabla users existe y tiene el usuario admin
SELECT * FROM users;
```

### 5. Credenciales por Defecto

Usuario: `admin`
Contraseña: `admin123`

**IMPORTANTE:** Cambia la contraseña después del primer login.

### 6. Verificar Logs

Si hay problemas, revisa los logs:

```bash
# Logs del backend API
docker logs <container_id_api>

# Logs de errores PHP (dentro del contenedor)
docker exec <container_id_api> cat /var/www/html/api/error.log
```

## Solución de Problemas

### Error: "Database connection not available"
- Verifica que las variables `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` estén configuradas
- El contenedor de la base de datos debe estar corriendo

### Error: "Table 'payments_db.users' doesn't exist"
- La base de datos no se inicializó correctamente
- Verifica que `database/schema.sql` existe y es válido
- Reinicia el contenedor de la base de datos para que ejecute el script de inicialización

### Error: "Empty response from server"
- El backend no está respondiendo
- Verifica que el contenedor `api` esté corriendo
- Revisa los logs del backend

### Error: "Server returned invalid response"
- El backend devolvió HTML (probablemente un error de PHP)
- Revisa los logs de errores PHP en `/var/www/html/api/error.log`

## Cambios Realizados

1. **database/schema.sql** - Agregada columna `created_at` a tabla `subscriptions`
2. **public/api/config.php** - Agregado manejador de errores fatales que siempre devuelve JSON
3. **public/api/auth.php** - Mejorado manejo de errores de base de datos
4. **src/services/api.js** - Mejorado manejo de respuestas no-JSON
5. **src/contexts/AuthContext.jsx** - Mejorados mensajes de error

## Redespliegue

Para aplicar los cambios en Dokploy:
1. Haz commit y push de los cambios
2. Dokploy debería detectar el cambio y redeplegar automáticamente
3. Si la base de datos ya tiene datos, necesitarás agregar la columna manualmente:

```sql
ALTER TABLE subscriptions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```
