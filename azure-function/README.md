# SMART QA — Azure Function (generación + envío de correo)

Azure Function (v4, Node 20) con dos endpoints:

- `generateEmail` — genera el correo de trazabilidad llamando a la API de
  Claude (key guardada del lado del servidor).
- `sendEmail` — arma el HTML del correo y lo manda como **puente** hacia la
  Send Mail API real de Connect (documentación: `SendMail-API-Connect.pdf`),
  que ya corre sobre el mismo Function App que usa AuditQA
  (`audit-qa-bceva8a6byeyehgx.eastus2-01.azurewebsites.net/api/sendMail`,
  MailerSend por debajo). El navegador nunca le pega directo a esa API — le
  pega a `sendEmail`, y `sendEmail` hace la llamada real con el Bearer token
  guardado como variable de entorno acá, nunca expuesto en el navegador.

El demo en GitHub Pages es estático — no puede generar con IA real ni
mandar correo por sí solo — así que llama a estas dos funciones por `fetch`.

## 1. Conseguir las credenciales

- **API key de Anthropic**, para `generateEmail`.
- **Bearer token de la Send Mail API** (`API_AUTH_TOKEN` en la documentación
  del PDF), para `sendEmail` — pedirlo a quien administre esa API si no lo
  tenés todavía.

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
    ANTHROPIC_API_KEY="<tu-api-key-de-Anthropic>" \
    SEND_MAIL_API_TOKEN="<el-bearer-token-de-la-Send-Mail-API>" \
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

## Límite a tener en cuenta

La Send Mail API acepta **máximo 10 solicitudes por hora por IP**. Como
`sendEmail` llama del lado del servidor, todas las llamadas salen con la
misma IP del Function App — ese límite se comparte entre **todo el equipo**
que use "Enviar correo" en SMART QA, no es 10 por persona. Si el volumen de
correos reales supera eso, hay que hablarlo con quien administra la Send
Mail API (posiblemente subir el límite o repartir el tráfico).
