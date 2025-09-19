import { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

export const useDataFetching = (endpoint) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        const result = await response.json();
        if (result.error) {
          throw new Error(result.error);
        }
        setData(result);
      } catch (err) {
        setError(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [endpoint]);

  return { data, loading, error };
};
