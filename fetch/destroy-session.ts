export async function fetchDestroySession() {
  try {
    const response = await fetch(`/auth/destroy-session`, {
      method: "POST",
    });

    return await response.json();
  } catch (err) {
    throw err;
  }
}
