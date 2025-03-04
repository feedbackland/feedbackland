export async function destroySessionFetch() {
  try {
    console.log(
      "destroySessionFetch() called",
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/destroy-session`,
    );

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/destroy-session`,
      {
        method: "POST",
      },
    );

    return response.json();
  } catch (err) {
    throw err;
  }
}
