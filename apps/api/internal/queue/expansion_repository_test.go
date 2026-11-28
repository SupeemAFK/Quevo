package queue

import "testing"

func TestValidateFormConfigurationSupportsLongAnswers(t *testing.T) {
	tests := []struct {
		name    string
		field   ServiceFormFieldInput
		wantErr bool
	}{
		{name: "short answer", field: ServiceFormFieldInput{Type: "short_text", Label: "Device model", Options: []string{}}},
		{name: "long answer", field: ServiceFormFieldInput{Type: "long_text", Label: "Describe the issue", Options: []string{}}},
		{name: "choice", field: ServiceFormFieldInput{Type: "single_select", Label: "Request type", Options: []string{"Replace", "Report"}}},
		{name: "long answer cannot have choices", field: ServiceFormFieldInput{Type: "long_text", Label: "Describe the issue", Options: []string{"Option"}}, wantErr: true},
		{name: "unknown control", field: ServiceFormFieldInput{Type: "date", Label: "Visit date", Options: []string{}}, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateFormConfiguration(FormConfiguration{Fields: []ServiceFormFieldInput{test.field}})
			if (err != nil) != test.wantErr {
				t.Fatalf("validateFormConfiguration() error = %v, want error %v", err, test.wantErr)
			}
		})
	}
}
