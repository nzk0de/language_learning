import asyncio
import logging
from datetime import datetime
from typing import Optional

from .es_utils import get_elastic_helper

logger = logging.getLogger(__name__)


class FeedScheduler:
    def __init__(self, fetch_interval_minutes: int = 30):
        self.fetch_interval_minutes = fetch_interval_minutes
        self.running = False
        self.task: Optional[asyncio.Task] = None
        self.es_client = None

    def set_es_client(self, es_client):
        """Set the Elasticsearch client."""
        self.es_client = es_client

    async def start(self):
        """Start the periodic RSS feed fetching."""
        if self.running:
            logger.warning("Scheduler already running")
            return

        self.running = True
        self.task = asyncio.create_task(self._fetch_loop())
        logger.info(
            f"Started RSS feed scheduler (interval: {self.fetch_interval_minutes} minutes)"
        )

    async def stop(self):
        """Stop the periodic RSS feed fetching."""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped RSS feed scheduler")

    async def _fetch_loop(self):
        """Main loop for periodic RSS feed fetching."""
        while self.running:
            try:
                logger.info("Starting periodic RSS feed fetch...")

                # Get ElasticHelper instance
                helper = get_elastic_helper()

                # Fetch all feeds
                results = await helper.fetch_all_rss_feeds()

                total_stored = results.get("totals", {}).get("rss_articles_stored", 0)
                logger.info(
                    f"Periodic fetch completed. Stored {total_stored} new articles: {results}"
                )

            except Exception as e:
                logger.error(f"Error in periodic RSS fetch: {e}")

            # Wait for the next interval
            try:
                await asyncio.sleep(self.fetch_interval_minutes * 60)
            except asyncio.CancelledError:
                break

    async def fetch_now(self) -> dict:
        """Trigger an immediate RSS feed fetch."""
        try:
            logger.info("Manual RSS feed fetch triggered")

            # Get ElasticHelper instance
            helper = get_elastic_helper()

            results = await helper.fetch_all_rss_feeds()

            total_stored = results.get("totals", {}).get("rss_articles_stored", 0)
            logger.info(f"Manual fetch completed. Stored {total_stored} new articles: {results}")

            return {
                "success": True,
                "results": results,
                "total_stored": total_stored,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error in manual RSS fetch: {e}")
            return {"success": False, "error": str(e), "timestamp": datetime.now().isoformat()}


# Global scheduler instance
_scheduler = None


def get_scheduler() -> FeedScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = FeedScheduler()
    return _scheduler
