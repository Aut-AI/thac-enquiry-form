-- "Archive" is functionally what removeSurveyor() already did (is_active =
-- false + user_id = null clears login and, via the existing
-- sync_outcodes_on_activation_change trigger, the surveyor's postcode
-- coverage) -- but it left status = 'paused', the same value toggleActive()
-- uses for a genuine temporary pause. That made a permanently-removed
-- surveyor indistinguishable in the CRM from someone just on a short break.
--
-- user_id IS NULL is the reliable signal for "this was a removal, not a
-- pause": toggleActive() never touches user_id, only removeSurveyor() did.
UPDATE surveyors SET status = 'archived' WHERE status = 'paused' AND user_id IS NULL;
