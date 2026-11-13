-- Custom SQL migration file, put your code below! --
CREATE FUNCTION touch_experiment(target uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE experiments
     SET updated_at = (now() AT TIME ZONE 'UTC')
   WHERE id = target
     AND updated_at < (now() AT TIME ZONE 'UTC') - interval '5 minutes';
$$;

CREATE FUNCTION touch_experiment_from_child()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM touch_experiment(COALESCE(NEW.experiment_id, OLD.experiment_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER experiment_dashboards_touch_experiment_updated_at
AFTER INSERT OR UPDATE OR DELETE ON experiment_dashboards
FOR EACH ROW
EXECUTE FUNCTION touch_experiment_from_child();

CREATE TRIGGER experiment_visualizations_touch_experiment_updated_at
AFTER INSERT OR UPDATE OR DELETE ON experiment_visualizations
FOR EACH ROW
EXECUTE FUNCTION touch_experiment_from_child();

CREATE TRIGGER experiment_locations_touch_experiment_updated_at
AFTER INSERT OR UPDATE OR DELETE ON experiment_locations
FOR EACH ROW
EXECUTE FUNCTION touch_experiment_from_child();

CREATE TRIGGER flows_touch_experiment_updated_at
AFTER INSERT OR UPDATE OR DELETE ON flows
FOR EACH ROW
EXECUTE FUNCTION touch_experiment_from_child();

CREATE TRIGGER experiment_devices_touch_experiment_updated_at
AFTER INSERT OR UPDATE OR DELETE ON experiment_devices
FOR EACH ROW
EXECUTE FUNCTION touch_experiment_from_child();
