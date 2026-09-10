# SMART QA — Función de envío de correo (SMTP)

Azure Function (v4, Node 20) que recibe el correo de trazabilidad ya generado
por el demo y lo envía de verdad por SMTP (Gmail). El demo en GitHub Pages es
estático — no puede mandar correo por sí solo — así que llama a esta función
por `fetch`.

## 1. Conseguir un App Password de Gmail

Necesita 2FA activado en `dayana.alvarado@connect.inc`. Luego:
Google Account → Seguridad → Verificación en 2 pasos → Contraseñas de
aplicaciones → generar una de 16 caracteres. Si el Workspace de Connect
tiene las App Passwords deshabilitadas a nivel admin, hay que pedirle a
quien administre Workspace que las habilite para esta cuenta (o usar OAuth2
en vez de App Password — es más trabajo, avisen si prefieren esa vía).

## 2. Crear la Function App en Azure

```bash
az login
az group create --name rg-smartqa --location eastus2
az storage account create --name stsmartqa --resource-group rg-smartqa --sku Standard_LRS
az functionapp create \
  --name smartqa-send-email \
  --resource-group rg-smartqa \
  --storage-account stsmartqa \
  --consumption-plan-location eastus2 \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4
```

## 3. Configurar variables de entorno (App Settings)

```bash
az functionapp config appsettings set \
  --name smartqa-send-email \
  --resource-group rg-smartqa \
  --settings \
    SMTP_HOST="smtp.gmail.com" \
    SMTP_PORT="465" \
    SMTP_USER="dayana.alvarado@connect.inc" \
    SMTP_APP_PASSWORD="<el-app-password-de-16-caracteres>" \
    ANTHROPIC_API_KEY="<tu-api-key-de-Anthropic>" \
    ALLOWED_ORIGIN="https://quality-sendemail.connectlabs.tech"
```

Para producción real (no solo demo), estas credenciales deberían migrar a
Key Vault en vez de vivir como App Setting en texto plano — mismo patrón
que ya usan en Connect Panel Agents.

## 4. Configurar CORS en el portal

Function App → CORS → agregar `https://quality-sendemail.connectlabs.tech`
(y `http://localhost` si van a probar local). Sin esto, el navegador va a
bloquear el fetch desde el demo aunque la función funcione bien.

## 5. Deployar el código

```bash
cd azure-function
npm install
func azure functionapp publish smartqa-send-email
```

## 6. Conseguir la Function Key

Portal → la function `sendEmail` (o `generateEmail`) → "Function Keys" → copiar `default`.
Con eso, las URLs a llamar desde el demo quedan:

```
https://smartqa-send-email.azurewebsites.net/api/sendEmail?code=<la-function-key>
https://smartqa-send-email.azurewebsites.net/api/generateEmail?code=<la-function-key>
```

Pasame esas dos URLs completas (con el `?code=...`) y conecto ambos botones del demo.
