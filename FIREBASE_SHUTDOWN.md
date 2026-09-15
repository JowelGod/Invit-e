# Cierre del prototipo Firebase

No se modificó el proyecto remoto `evento-dary`: esta ejecución no tiene una sesión autenticada
de Firebase Console/CLI. Los datos históricos no se migraron ni se incluyeron en Invitame.

## Acción manual recomendada

En Firebase Console abre el proyecto `evento-dary` y ve a **Firestore Database → Rules**.
Publica estas reglas de cierre total:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Si Firebase Storage estuvo habilitado, abre **Storage → Rules** y publica:

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{object=**} {
      allow read, write: if false;
    }
  }
}
```

Después prueba en una ventana privada que las consultas a Firestore respondan `permission-denied`.
No es necesario eliminar datos: cerrar reglas cumple el objetivo y conserva una recuperación
manual. Puede deshabilitarse Firebase Hosting por separado si tampoco se quiere mostrar el
prototipo, pero no es necesario para proteger Firestore.

Las variables `VITE_*` antiguas y credenciales Firebase no deben copiarse al proyecto nuevo.
También conviene restringir la API key histórica en Google Cloud Console a los dominios que aún
deban usarla, o deshabilitarla cuando el hosting antiguo ya no sea necesario.
