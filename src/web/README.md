Development note

This web app can optionally fetch service metadata from an external API at runtime. To enable fetching from an external source set the environment variable `VITE_SERVICE_METADATA_URL` to a URL that returns a JSON array of service metadata objects (the same shape as `service-metadata.json`).

Examples:

- Using docker-compose (repo root):

  ```bash
  SERVICE_METADATA_URL="https://example.com/service-metadata.json" docker-compose up --build web
  ```

- Or pass it to the dev server directly:

  ```bash
  VITE_SERVICE_METADATA_URL="https://example.com/service-metadata.json" npm run dev
  ```

Behaviour:
- If `VITE_SERVICE_METADATA_URL` is set the app will attempt to fetch the JSON once on startup; on success it will use the remote data; on failure it will keep using the bundled `service-metadata.json` as a fallback.
- You can also set a **runtime override** without rebuilding:
  - Open the UI and use the **Runtime override** input in the Filters pane to provide an arbitrary URL and click **Use**. This value is persisted in `localStorage` and takes precedence over `VITE_SERVICE_METADATA_URL`.
  - Alternatively, the app will pick up a runtime URL from `window.__SERVICE_METADATA_URL` or the `metadata_url` query parameter, if present.
- Use the **Refresh** button to re-fetch the configured URL at any time.
