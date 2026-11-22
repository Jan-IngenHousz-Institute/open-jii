locals {
  equipment_login_locales = "(?:en-US|de-DE)"
  equipment_auth_path     = "\\A(?:/${local.equipment_login_locales})?/(?:login|register)\\z"

  # Equipment builds /login/openjii with URLSearchParams for its relative redirect and state.
  equipment_redirect = "%252F(?:[A-Za-z0-9_~-](?:[A-Za-z0-9_~.*+-]|%25[0-9A-F]{2}|%2B)*)?"
  equipment_callback = "http%3A%2F%2Flocalhost%3A3100%2F(?:account|login%2Fopenjii(?:%3Fredirect%3D${local.equipment_redirect}(?:%26state%3D[A-Za-z0-9_-]{43})?)?)"

  # Signed-out registration wraps its encoded callback in a relative register URL for login.
  equipment_register_callback = "%2F${local.equipment_login_locales}%2Fregister%3FcallbackUrl%3D${replace(local.equipment_callback, "%", "%25")}"

  # Match the entire raw query because a single-query-argument match accepts any duplicate value.
  # Next can append a bare _rsc flag or a cache key on client navigations.
  equipment_callback_queries = [
    for callback in [local.equipment_callback, local.equipment_register_callback] :
    "\\AcallbackUrl=${callback}(?:&_rsc(?:=[A-Za-z0-9_-]{1,16})?)?\\z"
  ]

  # Better Auth serializes the three fields in OAuthLoginForm in insertion order.
  equipment_oauth_body = "\\A\\{\"provider\":\"(?:github|orcid)\",\"callbackURL\":\"https://dev\\.openjii\\.org/${local.equipment_login_locales}/register\\?callbackUrl=${local.equipment_callback}\",\"errorCallbackURL\":\"https://dev\\.openjii\\.org/login-error\"\\}\\z"

  equipment_callback_is_backend   = var.service_name == "backend"
  equipment_callback_managed_rule = local.equipment_callback_is_backend ? "EC2MetaDataSSRF_BODY" : "EC2MetaDataSSRF_QUERYARGUMENTS"
  equipment_callback_label        = local.equipment_callback_is_backend ? "EC2MetaDataSSRF_Body" : "EC2MetaDataSSRF_QueryArguments"
  equipment_callback_block        = local.equipment_callback_is_backend ? "BlockMetadataBodyRule" : "BlockMetadataQueryArgumentsRule"
}
