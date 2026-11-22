# Centinela ERP · Web comercial

Web en español e inglés para presentar Centinela, mostrar planes y recibir solicitudes. Incluye un panel privado de leads y clientes. Cada solicitud devuelve un número de seguimiento y mantiene el pago pendiente.

## Docker local

Copia `.env.example` a `.env` y configura un usuario y una contraseña comercial privada de al menos 14 caracteres.

```powershell
docker compose up -d --no-build --pull never
```

Para reconstruir tras cambios de código, ejecuta `docker compose build`. El build puede requerir imágenes y paquetes según tu caché. Docker conserva los leads en un volumen privado. `.env`, los datos y los artefactos locales están excluidos del repositorio.

- [Web local](http://localhost:8080/)
- [Panel de negocio](http://localhost:8080/admin)
- [Estado de la API](http://localhost:8080/api/health)

Con Node también se puede iniciar mediante `npm ci`, `npm run build` y `npm start`. La API comercial y su base de leads se mantienen separadas del ERP que opera cada empresa.

Los videos de `public/demos/` son guías ilustradas en español e inglés. Se pueden sustituir por grabaciones del producto validado manteniendo los mismos nombres de archivo.
