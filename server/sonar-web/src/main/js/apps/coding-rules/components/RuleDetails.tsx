/*
 * SonarQube
 * Copyright (C) 2009-2018 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import * as React from 'react';
import RuleDetailsCustomRules from './RuleDetailsCustomRules';
import RuleDetailsDescription from './RuleDetailsDescription';
import RuleDetailsIssues from './RuleDetailsIssues';
import RuleDetailsMeta from './RuleDetailsMeta';
import RuleDetailsParameters from './RuleDetailsParameters';
import RuleDetailsProfiles from './RuleDetailsProfiles';
import { Query } from '../query';
import { Profile } from '../../../api/quality-profiles';
import { getRuleDetails, deleteRule } from '../../../api/rules';
import { RuleActivation, RuleDetails as IRuleDetails } from '../../../app/types';
import DeferredSpinner from '../../../components/common/DeferredSpinner';
import { translate, translateWithParameters } from '../../../helpers/l10n';
import ConfirmButton from './ConfirmButton';

interface Props {
  allowCustomRules?: boolean;
  canWrite?: boolean;
  onDelete: (rule: string) => void;
  onFilterChange: (changes: Partial<Query>) => void;
  organization?: string;
  referencedProfiles: { [profile: string]: Profile };
  referencedRepositories: { [repository: string]: { key: string; language: string; name: string } };
  ruleKey: string;
}

interface State {
  actives?: RuleActivation[];
  loading: boolean;
  ruleDetails?: IRuleDetails;
}

export default class RuleDetails extends React.PureComponent<Props, State> {
  mounted: boolean;
  state: State = { loading: true };

  componentDidMount() {
    this.mounted = true;
    this.fetchRuleDetails();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.ruleKey !== this.props.ruleKey) {
      this.fetchRuleDetails();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  fetchRuleDetails = () => {
    this.setState({ loading: true });
    getRuleDetails({
      actives: true,
      key: this.props.ruleKey,
      organization: this.props.organization
    }).then(
      ({ actives, rule }) => {
        if (this.mounted) {
          this.setState({ actives, loading: false, ruleDetails: rule });
        }
      },
      () => {
        if (this.mounted) {
          this.setState({ loading: false });
        }
      }
    );
  };

  handleRuleChange = (ruleDetails: IRuleDetails) => {
    if (this.mounted) {
      this.setState({ ruleDetails });
    }
  };

  handleTagsChange = (tags: string[]) => {
    this.setState(state => ({ ruleDetails: { ...state.ruleDetails, tags } }));
  };

  handleDelete = () => {
    return deleteRule({ key: this.props.ruleKey }).then(() => {
      this.props.onDelete(this.props.ruleKey);
    });
  };

  handleEditClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.blur();
    // TODO
  };

  render() {
    const { ruleDetails } = this.state;

    if (!ruleDetails) {
      return <div className="coding-rule-details" />;
    }

    const { allowCustomRules, canWrite, organization, referencedProfiles } = this.props;
    const { params = [] } = ruleDetails;

    const isCustom = !!ruleDetails.templateKey;
    const isEditable = canWrite && !!this.props.allowCustomRules && isCustom;

    return (
      <div className="coding-rule-details">
        <DeferredSpinner loading={this.state.loading}>
          <RuleDetailsMeta
            canWrite={canWrite}
            onFilterChange={this.props.onFilterChange}
            onTagsChange={this.handleTagsChange}
            organization={organization}
            referencedRepositories={this.props.referencedRepositories}
            ruleDetails={ruleDetails}
          />

          <RuleDetailsDescription
            canWrite={canWrite}
            onChange={this.handleRuleChange}
            organization={organization}
            ruleDetails={ruleDetails}
          />

          {params.length > 0 && (
            <RuleDetailsParameters
              isCustom={ruleDetails.templateKey !== undefined}
              params={params}
            />
          )}

          {isEditable && (
            <div className="coding-rules-detail-description">
              <button
                className="js-edit-custom"
                id="coding-rules-detail-custom-rule-change"
                onClick={this.handleEditClick}>
                {translate('edit')}
              </button>
              <ConfirmButton
                confirmButtonText={translate('delete')}
                isDestructive={true}
                modalBody={translateWithParameters(
                  'coding_rules.delete.custom.confirm',
                  ruleDetails.name
                )}
                modalHeader={translate('coding_rules.delete_rule')}
                onConfirm={this.handleDelete}>
                {({ onClick }) => (
                  <button
                    className="button-red spacer-left js-delete"
                    id="coding-rules-detail-rule-delete"
                    onClick={onClick}>
                    {translate('delete')}
                  </button>
                )}
              </ConfirmButton>
            </div>
          )}

          {ruleDetails.isTemplate && (
            <RuleDetailsCustomRules
              canChange={allowCustomRules && canWrite}
              organization={organization}
              ruleKey={ruleDetails.key}
            />
          )}

          {!ruleDetails.isTemplate && (
            <RuleDetailsProfiles
              activations={this.state.actives}
              canWrite={canWrite}
              organization={organization}
              referencedProfiles={referencedProfiles}
              ruleDetails={ruleDetails}
            />
          )}

          {!ruleDetails.isTemplate && (
            <RuleDetailsIssues organization={organization} ruleKey={ruleDetails.key} />
          )}
        </DeferredSpinner>
      </div>
    );
  }
}
