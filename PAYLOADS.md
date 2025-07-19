# Sample document payload

```
$ curl -sH "Accept: application/json" -H "Authorization: Bearer $TOKEN" http://localhost:8001/rest/v2/contexts/default/documents | jq .
{
  "status": "success",
  "statusCode": 200,
  "message": "Documents retrieved successfully",
  "payload": [
    {
      "id": 100001,
      "schema": "data/abstraction/tab",
      "schemaVersion": "2.0",
      "data": {
        "url": "https://foo.bar",
        "title": "https://foo.bar",
        "timestamp": "2025-07-17T21:09:13.829Z"
      },
      "metadata": {
        "contentType": "application/json",
        "contentEncoding": "utf8",
        "dataPaths": []
      },
      "indexOptions": {
        "checksumAlgorithms": [
          "sha1",
          "sha256"
        ],
        "primaryChecksumAlgorithm": "sha1",
        "checksumFields": [
          "data.url"
        ],
        "ftsSearchFields": [
          "data.title",
          "data.url"
        ],
        "vectorEmbeddingFields": [
          "data.title",
          "data.url"
        ],
        "embeddingOptions": {
          "embeddingModel": "text-embedding-3-small",
          "embeddingDimensions": 1536,
          "embeddingProvider": "openai",
          "embeddingProviderOptions": {},
          "chunking": {
            "type": "sentence",
            "chunkSize": 1000,
            "chunkOverlap": 200
          }
        }
      },
      "createdAt": "2025-07-17T21:09:13.835Z",
      "updatedAt": "2025-07-17T21:09:13.835Z",
      "checksumArray": [
        "sha1/b9e416e5f287b164af5f84d8c318ad7ca7013daf",
        "sha256/c183e639e9340f668ab5ca3801c8b63b600e33f81cf809fc3228519bfb0c3a3c"
      ],
      "embeddingsArray": [],
      "parentId": null,
      "versions": [],
      "versionNumber": 1,
      "latestVersion": 1
    }
  ],
  "count": 1
}

$ curl -sH "Accept: application/json" -H "Authorization: Bearer $TOKEN" http://localhost:8001/rest/v2/contexts | jq .{
  "status": "success",
  "statusCode": 200,
  "message": "Contexts retrieved successfully",
  "payload": [
    {
      "id": "default",
      "userId": "a9x31ypp",
      "url": "universe://foo/bar",
      "baseUrl": "/",
      "path": "/foo/bar",
      "pathArray": [
        "foo",
        "bar"
      ],
      "workspaceId": "7c84589b-9268-45e8-9b7c-85c29adc9bca",
      "workspaceName": "universe",
      "color": "#ffffff",
      "acl": {},
      "createdAt": "2025-07-16T15:28:32.020Z",
      "updatedAt": "2025-07-16T21:45:06.661Z",
      "locked": false,
      "serverContextArray": [],
      "clientContextArray": [],
      "contextBitmapArray": [],
      "featureBitmapArray": [],
      "filterArray": [],
      "pendingUrl": null,
      "ownerEmail": "admin@canvas.local"
    }
  ],
  "count": 1
}


```
