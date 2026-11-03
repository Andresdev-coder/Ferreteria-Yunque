# Despliegue de Ferretería Yunque

La aplicación usa PostgreSQL para los seis microservicios de negocio. En Neon se usa una sola base de datos y cada servicio crea su esquema (`yunque_usuarios`, `yunque_inventario`, `yunque_ventas`, `yunque_facturacion`, `yunque_compras`, `yunque_reportes`). Las tablas se crean al iniciar cada servicio.

## 1. Neon

1. Crea un proyecto y una base de datos en Neon.
2. Copia la URL de conexión **pooled** y úsala como `DATABASE_URL` en el grupo `yunque-shared` de Render.
3. Mantén `sslmode=require` en la URL.

Los `.env.example` de cada servicio muestran las variables para desarrollo local. No subas los `.env` reales al repositorio.

## 2. RabbitMQ

RabbitMQ sigue siendo necesario para propagar eventos entre inventario, ventas, compras, facturación y reportes, y para las notificaciones en vivo del gateway. Crea una instancia de RabbitMQ con acceso AMQP desde Render y coloca su URL completa como `RABBIT_URL` en el grupo `yunque-shared`. La URL debe usar AMQPS si el proveedor exige TLS.

## 3. Render

1. Conecta el repositorio en Render y crea los servicios desde el Blueprint `render.yaml`.
2. Render genera `JWT_SECRET` y lo comparte mediante el grupo `yunque-shared`. En las preguntas iniciales del Blueprint, pega la misma URL pooled de Neon en los seis `DATABASE_URL` y la URL de RabbitMQ en los seis `RABBIT_URL` de los servicios que la necesitan (inventario, ventas, facturación, compras, reportes y gateway).
3. Para `FRONT_ORIGIN`, puedes poner temporalmente `http://localhost:5173`; lo reemplazarás después de publicar en Vercel.
4. Las URLs del gateway y la URL de Ventas para Reportes se conectan automáticamente a los servicios creados por el Blueprint.
5. Espera a que los servicios estén listos y copia la URL pública de `yunque-gateway`.

El Blueprint define los siete procesos porque el gateway enruta a seis microservicios independientes. En el plan gratuito de Render los servicios pueden dormir y tardar en despertar; usa instancias persistentes si necesitas disponibilidad continua.

## 4. Vercel

1. Importa el repositorio y configura `Frontend` como directorio raíz.
2. Usa Vite, `pnpm build` y `dist` como directorio de salida.
3. Define `VITE_API_URL` con la URL pública HTTPS de `yunque-gateway`.
4. Copia el dominio asignado por Vercel y cambia `FRONT_ORIGIN` en `yunque-gateway` desde **Environment** en Render. Guarda y redepliega el gateway.

La configuración de `Frontend/vercel.json` permite que las rutas de React vuelvan a `index.html`.

## 5. Migrar datos que ya estén en MySQL

El cambio de motor crea tablas PostgreSQL vacías; no copia automáticamente los registros del MySQL anterior. Si necesitas conservar información, expórtala de MySQL y transforma/importa los datos en los esquemas correspondientes antes de atender tráfico.

## Desarrollo local

`docker-compose.yml` levanta PostgreSQL en `localhost:5433` y RabbitMQ en `localhost:5672`. Copia cada `.env.example` como `.env` en su servicio y arranca los microservicios; cada uno inicializa su esquema y sus tablas al iniciar.
