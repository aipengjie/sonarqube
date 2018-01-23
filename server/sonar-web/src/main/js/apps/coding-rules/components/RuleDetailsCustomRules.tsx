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
import { Link } from 'react-router';
import { searchRules } from '../../../api/rules';
import { Rule } from '../../../app/types';
import DeferredSpinner from '../../../components/common/DeferredSpinner';
import SeverityHelper from '../../../components/shared/SeverityHelper';
import { translate } from '../../../helpers/l10n';
import { getRuleUrl } from '../../../helpers/urls';

interface Props {
  canChange?: boolean;
  organization?: string;
  ruleKey: string;
}

interface State {
  loading: boolean;
  rules?: Rule[];
}

export default class RuleDetailsCustomRules extends React.PureComponent<Props, State> {
  mounted: boolean;
  state: State = { loading: false };

  componentDidMount() {
    this.mounted = true;
    this.fetchrules();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.ruleKey !== this.props.ruleKey) {
      this.fetchrules();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  fetchrules = () => {
    this.setState({ loading: true });
    searchRules({
      /* eslint-disable camelcase */
      template_key: this.props.ruleKey,
      /* eslint-enable camelcase */
      f: 'name,severity,params'
    }).then(
      ({ rules }) => {
        if (this.mounted) {
          this.setState({ rules, loading: false });
        }
      },
      () => {
        if (this.mounted) {
          this.setState({ loading: false });
        }
      }
    );
  };

  renderRule = (rule: Rule) => (
    <tr key={rule.key}>
      <td className="coding-rules-detail-list-name">
        <Link to={getRuleUrl(rule.key, this.props.organization)}>{rule.name}</Link>
      </td>

      <td className="coding-rules-detail-list-severity">
        <SeverityHelper severity={rule.severity} />
      </td>

      <td className="coding-rules-detail-list-parameters">
        {rule.params &&
          rule.params.filter(param => param.defaultValue).map(param => (
            <div className="coding-rules-detail-list-parameter" key={param.key}>
              <span className="key">{param.key}</span>
              <span className="sep">:&nbsp;</span>
              <span className="value" title={param.defaultValue}>
                {param.defaultValue}
              </span>
            </div>
          ))}
      </td>

      {this.props.canChange && (
        <td className="coding-rules-detail-list-actions">
          <button className="js-delete-custom-rule button-red">{translate('delete')}</button>
        </td>
      )}
    </tr>
  );

  render() {
    const { loading, rules = [] } = this.state;

    return (
      <div className="js-rule-custom-rules coding-rule-section">
        <div className="coding-rules-detail-custom-rules-section">
          <div className="coding-rule-section-separator" />

          <h3 className="coding-rules-detail-title">{translate('coding_rules.custom_rules')}</h3>

          {this.props.canChange && (
            <button className="js-create-custom-rule spacer-left">
              {translate('coding_rules.create')}
            </button>
          )}

          <DeferredSpinner loading={loading}>
            {rules.length > 0 && (
              <table id="coding-rules-detail-custom-rules" className="coding-rules-detail-list">
                <tbody>{rules.map(this.renderRule)}</tbody>
              </table>
            )}
          </DeferredSpinner>
        </div>
      </div>
    );
  }
}
