# T4 Agent loop
- [x] Agent profiles (agent / inline) as JSON in `agents/`
- [x] TurnRunner: stream, delta merge, approvals → review, resume after last event
- [x] Failover chain with classifier, single retry, circuit breaker, first-output watchdog
- [x] Cancel: abort stream, discard reviews, deny pending approvals, `sessions.cancel`
- [x] Inline edit command (Ctrl+Alt+K)
- [ ] Live verification of Tasks A/B/C on Flask (E2E + manual)
