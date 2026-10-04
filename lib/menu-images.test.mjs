import assert from "node:assert/strict";
import test from "node:test";
import { getSignedMenuImageUrl, signMenuImages, uploadMenuImage } from "./menu-images.js";

function createStorageClient(result) {
  const calls = [];
  return {
    calls,
    storage: {
      from(bucket) {
        return {
          async createSignedUrl(path, expiresIn) {
            calls.push({ bucket, path, expiresIn });
            return result;
          },
        };
      },
    },
  };
}

test("missing menu image objects return null without rejecting menu reads", async () => {
  const client = createStorageClient({ data: null, error: { message: "Object not found" } });
  const menuItems = await signMenuImages(client, [
    { id: "missing", image_url: "restaurant-id/missing.jpg" },
  ]);

  assert.equal(menuItems[0].image_url, null);
  assert.deepEqual(client.calls, [
    { bucket: "menu-images", path: "restaurant-id/missing.jpg", expiresIn: 3600 },
  ]);
});

test("valid menu images keep using their existing signed URL path", async () => {
  const client = createStorageClient({ data: { signedUrl: "https://storage.test/signed-image" }, error: null });
  const imageUrl = await getSignedMenuImageUrl(client, "restaurant-id/valid.jpg");

  assert.equal(imageUrl, "https://storage.test/signed-image");
  assert.equal(client.calls[0].path, "restaurant-id/valid.jpg");
});

test("non-missing Storage errors still propagate", async () => {
  const client = createStorageClient({ data: null, error: { message: "Storage service unavailable" } });

  await assert.rejects(
    getSignedMenuImageUrl(client, "restaurant-id/image.jpg"),
    (error) => error.message === "Storage service unavailable"
  );
});

test("legacy signed image URLs resolve to their existing object path", async () => {
  const client = createStorageClient({ data: { signedUrl: "https://storage.test/signed-image" }, error: null });
  await getSignedMenuImageUrl(
    client,
    "https://storage.test/storage/v1/object/sign/menu-images/restaurant-id/image%20one.jpg?token=redacted"
  );

  assert.equal(client.calls[0].bucket, "menu-images");
  assert.equal(client.calls[0].path, "restaurant-id/image one.jpg");
});

test("uploaded menu images are verified before returning their exact object path", async () => {
  const calls = [];
  const client = {
    storage: {
      from(bucket) {
        return {
          async upload(path, _file, options) {
            calls.push({ operation: "upload", bucket, path, options });
            return { data: { path, id: "uploaded-id", fullPath: `menu-images/${path}` }, error: null };
          },
          async createSignedUrl(path, expiresIn) {
            calls.push({ operation: "verify", bucket, path, expiresIn });
            return { data: { signedUrl: "https://storage.test/verified" }, error: null };
          },
        };
      },
    },
  };

  const diagnostics = [];
  const path = await uploadMenuImage(
    client,
    "restaurant-id",
    { name: "dish.jpeg", type: "image/jpeg", size: 123 },
    (stage, details) => diagnostics.push({ stage, details })
  );

  assert.match(path, /^restaurant-id\/[\da-f-]+\.jpeg$/i);
  assert.deepEqual(calls.map(({ operation, bucket, path: objectPath }) => ({ operation, bucket, path: objectPath })), [
    { operation: "upload", bucket: "menu-images", path },
    { operation: "verify", bucket: "menu-images", path },
  ]);
  assert.equal(diagnostics[0].stage, "storage.upload.request");
  assert.equal(diagnostics[0].details.objectPath, path);
  assert.equal(diagnostics[1].stage, "storage.upload.response");
  assert.equal(diagnostics[1].details.response.data.path, path);
  assert.equal(diagnostics[1].details.response.httpStatus, null);
  assert.equal(diagnostics[3].stage, "storage.verify.response");
  assert.equal(diagnostics[3].details.response.data.signedUrlReturned, true);
});

test("upload diagnostics preserve the Storage HTTP status and error fields", async () => {
  const error = Object.assign(new Error("new row violates row-level security policy"), {
    code: "42501",
    details: "Storage object insert was rejected.",
    hint: "Check the active manager policy.",
    statusCode: "403",
    statusText: "Forbidden",
  });
  const client = {
    storage: {
      from() {
        return {
          async upload() {
            return { data: null, error };
          },
        };
      },
    },
  };
  const diagnostics = [];

  await assert.rejects(
    uploadMenuImage(
      client,
      "restaurant-id",
      { name: "dish.jpg", type: "image/jpeg", size: 123 },
      (stage, details) => diagnostics.push({ stage, details })
    ),
    (caught) => caught === error
  );

  const response = diagnostics.find(({ stage }) => stage === "storage.upload.response");
  assert.equal(response.details.response.httpStatus, 403);
  assert.deepEqual(response.details.response.error, {
    name: "Error",
    message: "new row violates row-level security policy",
    code: "42501",
    details: "Storage object insert was rejected.",
    hint: "Check the active manager policy.",
    httpStatus: 403,
    statusText: "Forbidden",
  });
});

test("unverified uploads are removed and never return a stored path", async () => {
  const calls = [];
  const client = {
    storage: {
      from(bucket) {
        return {
          async upload(path) {
            calls.push({ operation: "upload", bucket, path });
            return { error: null };
          },
          async createSignedUrl(path) {
            calls.push({ operation: "verify", bucket, path });
            return { data: null, error: { message: "Object not found" } };
          },
          async remove(paths) {
            calls.push({ operation: "remove", bucket, path: paths[0] });
            return { error: null };
          },
        };
      },
    },
  };

  await assert.rejects(
    uploadMenuImage(client, "restaurant-id", { name: "dish.jpg" }),
    (error) => error.message === "Object not found"
  );
  assert.deepEqual(calls.map(({ operation }) => operation), ["upload", "verify", "remove"]);
  assert.equal(calls[0].path, calls[2].path);
});