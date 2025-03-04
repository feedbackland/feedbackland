export async function destroySessionFetch() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/destroy-session`,
      {
        method: "POST",
      },
    );

    return await response.json();
  } catch (err) {
    throw err;
  }
}
