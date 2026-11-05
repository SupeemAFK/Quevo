package apidocs

import _ "embed"

// Spec is generated from the API handler annotations with `make generate-openapi`.
//
//go:embed swagger.json
var Spec []byte
