export function getStoragePath(value) {
  if (!value) return null;
  const rawValue = String(value);
  const publicMarker = "/object/public/menu-images/";
  const signedMarker = "/object/sign/menu-images/";
  const marker = rawValue.includes(publicMarker) ? publicMarker : signedMarker;
  const markerIndex = rawValue.indexOf(marker);
  if (markerIndex >= 0) return decodeURIComponent(rawValue.slice(markerIndex + marker.length).split("?")[0]);
  return rawValue.includes("/") ? rawValue : null;
}

function describeError(error) {
  if (!error) return null;
  const status = error.status ?? error.statusCode ?? error.context?.status ?? null;
  const numericStatus = status === null ? null : Number(status);

  return {
    name: error.name || null,
    message: error.message || null,
    code: error.code || null,
    details: error.details || null,
    hint: error.hint || null,
    httpStatus: numericStatus !== null && Number.isFinite(numericStatus) ? numericStatus : status,
    statusText: error.statusText || error.context?.statusText || null,
  };
}

export async function uploadMenuImage(supabase, restaurantId, file, onDiagnostic = () => {}) {
  const extension = file.name.toLowerCase().endsWith(".jpeg") ? "jpeg" : "jpg";
  const path = `${restaurantId}/${crypto.randomUUID()}.${extension}`;
  const storage = supabase.storage.from("menu-images");
  const uploadOptions = {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  };
  let uploadResponse;

  onDiagnostic("storage.upload.request", {
    bucket: "menu-images",
    objectPath: path,
    file: { name: file.name, type: file.type, size: file.size },
    options: uploadOptions,
  });

  try {
    uploadResponse = await storage.upload(path, file, uploadOptions);
  } catch (error) {
    const originalError = error;
    onDiagnostic("storage.upload.threw", {
      bucket: "menu-images",
      objectPath: path,
      error: describeError(originalError),
    });
    throw originalError;
  }

  const { data: uploadData, error: uploadError } = uploadResponse;
  onDiagnostic("storage.upload.response", {
    bucket: "menu-images",
    objectPath: path,
    response: {
      data: uploadData || null,
      error: describeError(uploadError),
      httpStatus: uploadError ? describeError(uploadError).httpStatus : null,
    },
  });

  if (uploadError) throw uploadError;

  try {
    onDiagnostic("storage.verify.request", {
      bucket: "menu-images",
      objectPath: path,
    });
    const { data, error } = await storage.createSignedUrl(path, 60);
    onDiagnostic("storage.verify.response", {
      bucket: "menu-images",
      objectPath: path,
      response: {
        data: data ? { path: data.path || path, signedUrlReturned: Boolean(data.signedUrl) } : null,
        error: describeError(error),
        httpStatus: error ? describeError(error).httpStatus : null,
      },
    });
    if (error) throw error;
    if (!data?.signedUrl) throw new Error("Uploaded menu image could not be verified.");
  } catch (error) {
    const originalError = error;
    onDiagnostic("storage.verify.failed", {
      bucket: "menu-images",
      objectPath: path,
      error: describeError(originalError),
    });
    await removeMenuImage(supabase, path, onDiagnostic).catch((cleanupError) => {
      const originalCleanupError = cleanupError;
      onDiagnostic("storage.verify.cleanup.failed", {
        bucket: "menu-images",
        objectPath: path,
        error: describeError(originalCleanupError),
      });
    });
    throw originalError;
  }

  return path;
}

export async function removeMenuImage(supabase, path, onDiagnostic = () => {}) {
  if (!path) return;

  onDiagnostic("storage.remove.request", {
    bucket: "menu-images",
    objectPaths: [path],
  });
  const response = await supabase.storage.from("menu-images").remove([path]);
  const { data, error } = response;
  onDiagnostic("storage.remove.response", {
    bucket: "menu-images",
    objectPaths: [path],
    response: {
      data: data || null,
      error: describeError(error),
      httpStatus: error ? describeError(error).httpStatus : null,
    },
  });
  if (error) throw error;
}

export async function getSignedMenuImageUrl(supabase, value) {
  const path = getStoragePath(value);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from("menu-images")
    .createSignedUrl(path, 60 * 60);

  if (error?.message?.toLowerCase().includes("object not found")) return null;
  if (error) throw error;
  return data?.signedUrl || null;
}

export async function signMenuImages(supabase, items) {
  return Promise.all((items || []).map(async (item) => ({
    ...item,
    image_url: await getSignedMenuImageUrl(supabase, item.image_url),
  })));
}
